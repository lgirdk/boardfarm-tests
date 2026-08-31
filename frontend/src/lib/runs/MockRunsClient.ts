import type { ConsoleLine, Run, RunArtifact, RunEvent, RunFilter, WorkflowDef } from "@/lib/contracts";
import type { RunsClient, TriggerOptions } from "./RunsClient";
import type { RunEngine } from "./engine";
import type { WorkflowBehavior } from "@/lib/workflows/seed";
import { MOCK_BEHAVIOR, WORKFLOWS_SEED } from "@/lib/workflows/seed";
import { buildTranscript } from "./transcript";
import { RUN_ARTIFACTS_SEED } from "./runArtifactsSeed";

/**
 * Thin async facade over the timer-driven RunEngine. All simulation lives in
 * the engine; this class only resolves workflow definitions and adapts the
 * RunsClient interface.
 */
export class MockRunsClient implements RunsClient {
  constructor(
    private readonly engine: RunEngine,
    private readonly workflows: WorkflowDef[] = WORKFLOWS_SEED,
    private readonly behaviors: Record<string, WorkflowBehavior> = MOCK_BEHAVIOR,
  ) {}

  async trigger(
    workflowName: string,
    input: Record<string, unknown>,
    options?: TriggerOptions,
  ): Promise<Run> {
    const workflow = this.workflows.find((w) => w.name === workflowName);
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }
    return this.engine.trigger({
      workflow,
      input,
      behavior: this.behaviors[workflowName],
      pauseAfter: options?.pauseAfter,
      triggeredBy: options?.triggeredBy,
    });
  }

  async get(runId: string): Promise<Run | null> {
    return this.engine.get(runId);
  }

  async list(filter?: RunFilter): Promise<Run[]> {
    return this.engine.list(filter);
  }

  async approve(runId: string): Promise<Run> {
    return this.engine.approve(runId);
  }

  async cancel(runId: string): Promise<Run> {
    return this.engine.cancel(runId);
  }

  subscribe(runId: string, onEvent: (event: RunEvent) => void): () => void {
    return this.engine.subscribe(runId, onEvent);
  }

  async console(runId: string): Promise<ConsoleLine[]> {
    const run = this.engine.get(runId);
    return run ? buildTranscript(run) : [];
  }

  async runArtifacts(runId: string): Promise<RunArtifact[]> {
    const run = this.engine.get(runId);
    if (!run) return [];
    const collect = run.steps.find((s) => s.name === "collect");
    if (!collect || collect.state === "pending") return [];
    return structuredClone(RUN_ARTIFACTS_SEED);
  }
}
