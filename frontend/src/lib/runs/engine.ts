import type {
  Run,
  RunEvent,
  RunFilter,
  RunStep,
  WorkflowDef,
} from "@/lib/contracts";
import type {
  StepArtifactSpec,
  WorkflowBehavior,
} from "@/lib/workflows/seed";

/**
 * The mock run engine — a real little state machine, not static data.
 *
 * trigger() creates a `queued` run, then timers advance it step by step,
 * emitting RunEvents to subscribers. A step that needs approval (or follows a
 * user-selected "pause after" step) enters `awaiting_approval` before it
 * executes, and stays there until approve(). Behavior (durations, summaries,
 * produced artifacts, deliberate failures) comes from per-workflow metadata.
 *
 * Runs persist in this module-level store, so navigating away and back shows
 * correct state. Timer-driven by design — tests drive it with fake timers.
 */

const QUEUE_DELAY_MS = 700;
const DEFAULT_STEP_MS = 3000;

export interface EngineOptions {
  /** Called when a step produces artifacts; returns their ids. */
  createArtifact?: (
    spec: StepArtifactSpec,
    run: Run,
    stepName: string,
  ) => string;
}

interface TriggerArgs {
  workflow: WorkflowDef;
  input: Record<string, unknown>;
  behavior?: WorkflowBehavior;
  pauseAfter?: string[];
  triggeredBy?: string;
  workspace?: string;
  /** Built when the final step completes (app-style runs return output). */
  makeOutput?: (run: Run) => Record<string, unknown>;
}

type Listener = (event: RunEvent) => void;

export class RunEngine {
  private readonly runs = new Map<string, Run>();
  private readonly behaviors = new Map<string, WorkflowBehavior>();
  private readonly outputs = new Map<string, (run: Run) => Record<string, unknown>>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private counter: number;

  constructor(
    private readonly options: EngineOptions = {},
    startCounterAt = 1,
  ) {
    this.counter = startCounterAt;
  }

  /* ── public API (what the clients expose) ───────────────────────────── */

  trigger(args: TriggerArgs): Run {
    const id = `r-${String(this.counter++).padStart(4, "0")}`;
    const run: Run = {
      id,
      workflow: args.workflow.name,
      workflow_title: args.workflow.title,
      status: "queued",
      triggered_by: args.triggeredBy ?? "you",
      workspace: args.workspace ?? "docsis-team",
      created_at: Date.now(),
      steps: args.workflow.steps.map(
        (s): RunStep => ({
          name: s.name,
          title: s.title,
          approval: s.approval,
          label: s.label,
          state: "pending",
          summary: s.summary,
        }),
      ),
      input: args.input,
      pause_after: args.pauseAfter,
    };
    this.runs.set(id, run);
    if (args.behavior) this.behaviors.set(id, args.behavior);
    if (args.makeOutput) this.outputs.set(id, args.makeOutput);

    this.emit(run, "status", "Run queued");
    this.schedule(id, QUEUE_DELAY_MS, () => this.enterStep(id, 0));
    return snapshot(run);
  }

  get(runId: string): Run | null {
    const run = this.runs.get(runId);
    return run ? snapshot(run) : null;
  }

  list(filter?: RunFilter): Run[] {
    let all = [...this.runs.values()];
    if (filter?.status?.length) {
      all = all.filter((r) => filter.status!.includes(r.status));
    }
    if (filter?.workflow) {
      all = all.filter((r) => r.workflow === filter.workflow);
    }
    return all
      .sort((a, b) => b.created_at - a.created_at)
      .map((r) => snapshot(r));
  }

  approve(runId: string): Run {
    const run = this.mustGet(runId);
    if (run.status !== "awaiting_approval") {
      throw new Error(`Run ${runId} is not awaiting approval`);
    }
    const index = run.steps.findIndex((s) => s.state === "awaiting_approval");
    if (index === -1) throw new Error(`Run ${runId} has no awaiting step`);
    this.emit(run, "status", `Approved: ${run.steps[index]!.name}`);
    this.startStep(runId, index);
    return snapshot(run);
  }

  cancel(runId: string): Run {
    const run = this.mustGet(runId);
    if (isTerminal(run.status)) return snapshot(run);
    this.clearTimer(runId);
    for (const step of run.steps) {
      if (step.state === "running" || step.state === "awaiting_approval") {
        step.state = "skipped";
      }
    }
    run.status = "cancelled";
    run.finished_at = Date.now();
    run.current_step = undefined;
    this.emit(run, "status", "Run cancelled");
    return snapshot(run);
  }

  subscribe(runId: string, onEvent: Listener): () => void {
    let set = this.listeners.get(runId);
    if (!set) {
      set = new Set();
      this.listeners.set(runId, set);
    }
    set.add(onEvent);
    const run = this.runs.get(runId);
    if (run) {
      onEvent(makeEvent(run, "status", "Subscribed"));
    }
    return () => {
      set!.delete(onEvent);
    };
  }

  /** Seed a pre-existing (historical) run without starting timers. */
  seed(run: Run, behavior?: WorkflowBehavior): void {
    this.runs.set(run.id, run);
    if (behavior) this.behaviors.set(run.id, behavior);
  }

  /* ── internals: the state machine ───────────────────────────────────── */

  /** A step is reached: pause for approval if gated, else start it. */
  private enterStep(runId: string, index: number): void {
    const run = this.mustGet(runId);
    const step = run.steps[index];
    if (!step) return this.finish(runId);

    const previous = run.steps[index - 1];
    const pausedByUser =
      previous !== undefined && (run.pause_after ?? []).includes(previous.name);

    if (step.approval || pausedByUser) {
      step.state = "awaiting_approval";
      run.status = "awaiting_approval";
      run.current_step = step.name;
      this.emit(run, "step", `Waiting for approval: ${step.name}`, step.name);
      return; // resumes via approve()
    }
    this.startStep(runId, index);
  }

  private startStep(runId: string, index: number): void {
    const run = this.mustGet(runId);
    const step = run.steps[index]!;
    step.state = "running";
    step.started_at = Date.now();
    run.status = "running";
    run.current_step = step.name;
    if (!run.started_at) run.started_at = Date.now();
    this.emit(run, "step", `Started: ${step.name}`, step.name);

    const behavior = this.behaviors.get(runId)?.steps[step.name];
    this.schedule(runId, behavior?.duration ?? DEFAULT_STEP_MS, () =>
      this.completeStep(runId, index),
    );
  }

  private completeStep(runId: string, index: number): void {
    const run = this.mustGet(runId);
    const step = run.steps[index]!;
    const workflowBehavior = this.behaviors.get(runId);
    const behavior = workflowBehavior?.steps[step.name];

    if (workflowBehavior?.failAtStep === step.name) {
      step.state = "failed";
      step.finished_at = Date.now();
      run.status = "failed";
      run.finished_at = Date.now();
      run.error = {
        step: step.name,
        message: workflowBehavior.failMessage ?? `Step ${step.name} failed`,
      };
      this.emit(run, "error", run.error.message, step.name);
      return;
    }

    step.state = "completed";
    step.finished_at = Date.now();
    if (behavior?.summary) step.summary = behavior.summary;
    if (behavior?.details) step.details = behavior.details;

    if (behavior?.artifacts && this.options.createArtifact) {
      step.artifact_ids = behavior.artifacts.map((spec) =>
        this.options.createArtifact!(spec, run, step.name),
      );
      this.emit(
        run,
        "artifact",
        `${step.artifact_ids.length} artifact(s) from ${step.name}`,
        step.name,
      );
    }

    this.emit(run, "step", `Completed: ${step.name}`, step.name);
    this.enterStep(runId, index + 1);
  }

  private finish(runId: string): void {
    const run = this.mustGet(runId);
    run.status = "completed";
    run.finished_at = Date.now();
    run.current_step = undefined;
    const makeOutput = this.outputs.get(runId);
    if (makeOutput) run.output = makeOutput(snapshot(run));
    this.emit(run, "status", "Run completed");
  }

  private schedule(runId: string, ms: number, fn: () => void): void {
    this.clearTimer(runId);
    this.timers.set(
      runId,
      setTimeout(() => {
        this.timers.delete(runId);
        fn();
      }, ms),
    );
  }

  private clearTimer(runId: string): void {
    const timer = this.timers.get(runId);
    if (timer) clearTimeout(timer);
    this.timers.delete(runId);
  }

  private emit(
    run: Run,
    type: RunEvent["type"],
    message: string,
    stepName?: string,
  ): void {
    const event = makeEvent(run, type, message, stepName);
    for (const listener of this.listeners.get(run.id) ?? []) {
      listener(event);
    }
  }

  private mustGet(runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Unknown run: ${runId}`);
    return run;
  }
}

function makeEvent(
  run: Run,
  type: RunEvent["type"],
  message: string,
  stepName?: string,
): RunEvent {
  return {
    run_id: run.id,
    ts: Date.now(),
    type,
    message,
    step: stepName,
    run: snapshot(run),
  };
}

function snapshot(run: Run): Run {
  return structuredClone(run);
}

export function isTerminal(status: Run["status"]): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}
