import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunEvent, WorkflowDef } from "@/lib/contracts";
import type { WorkflowBehavior } from "@/lib/workflows/seed";
import { RunEngine } from "./engine";

const WF: WorkflowDef = {
  name: "wf",
  title: "Workflow",
  description: "",
  steps: [
    { name: "a", title: "A" },
    { name: "gate", title: "Gate", approval: true },
    { name: "b", title: "B" },
  ],
  input_descriptor: [],
};

const BEHAVIOR: WorkflowBehavior = {
  steps: {
    a: { duration: 1000, summary: "a done" },
    gate: { duration: 500, summary: "approved" },
    b: { duration: 1000, summary: "b done" },
  },
};

describe("RunEngine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function start(overrides?: Partial<Parameters<RunEngine["trigger"]>[0]>) {
    const engine = new RunEngine({}, 1);
    const run = engine.trigger({
      workflow: WF,
      input: { x: 1 },
      behavior: BEHAVIOR,
      ...overrides,
    });
    return { engine, run };
  }

  it("assigns sequential ids and starts queued", () => {
    const { engine, run } = start();
    expect(run.id).toBe("r-0001");
    expect(run.status).toBe("queued");
    expect(engine.get("r-0001")!.steps.map((s) => s.state)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("advances step by step on timers", () => {
    const { engine, run } = start();
    vi.advanceTimersByTime(700); // queue delay → step a running
    expect(engine.get(run.id)!.status).toBe("running");
    expect(engine.get(run.id)!.current_step).toBe("a");

    vi.advanceTimersByTime(1000); // a completes → gate reached
    const afterA = engine.get(run.id)!;
    expect(afterA.steps[0]!.state).toBe("completed");
    expect(afterA.steps[0]!.summary).toBe("a done");
  });

  it("pauses at a gateway step until approve(), then continues to completion", () => {
    const { engine, run } = start();
    vi.advanceTimersByTime(700 + 1000); // a done → gate awaiting
    let current = engine.get(run.id)!;
    expect(current.status).toBe("awaiting_approval");
    expect(current.steps[1]!.state).toBe("awaiting_approval");

    // Time passing does NOT resume a gated run.
    vi.advanceTimersByTime(60_000);
    expect(engine.get(run.id)!.status).toBe("awaiting_approval");

    engine.approve(run.id);
    expect(engine.get(run.id)!.steps[1]!.state).toBe("running");

    vi.advanceTimersByTime(500 + 1000); // gate + b complete
    current = engine.get(run.id)!;
    expect(current.status).toBe("completed");
    expect(current.steps.map((s) => s.state)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
    expect(current.finished_at).toBeDefined();
  });

  it("honors user-requested pause-after steps", () => {
    const noGateWf: WorkflowDef = {
      ...WF,
      steps: WF.steps.map((s) => ({ ...s, approval: false })),
    };
    const engine = new RunEngine({}, 1);
    const run = engine.trigger({
      workflow: noGateWf,
      input: {},
      behavior: BEHAVIOR,
      pauseAfter: ["a"],
    });
    vi.advanceTimersByTime(700 + 1000); // a completes → pause before gate
    expect(engine.get(run.id)!.status).toBe("awaiting_approval");
    engine.approve(run.id);
    vi.advanceTimersByTime(500 + 1000);
    expect(engine.get(run.id)!.status).toBe("completed");
  });

  it("fails at the configured step with the error surfaced", () => {
    const { engine, run } = start({
      behavior: { ...BEHAVIOR, failAtStep: "a", failMessage: "boom" },
    });
    vi.advanceTimersByTime(700 + 1000);
    const failed = engine.get(run.id)!;
    expect(failed.status).toBe("failed");
    expect(failed.steps[0]!.state).toBe("failed");
    expect(failed.error).toEqual({ step: "a", message: "boom" });
    // nothing further runs
    vi.advanceTimersByTime(60_000);
    expect(engine.get(run.id)!.steps[1]!.state).toBe("pending");
  });

  it("cancel() stops a running run and skips the active step", () => {
    const { engine, run } = start();
    vi.advanceTimersByTime(700); // a running
    engine.cancel(run.id);
    const cancelled = engine.get(run.id)!;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.steps[0]!.state).toBe("skipped");
    vi.advanceTimersByTime(60_000);
    expect(engine.get(run.id)!.status).toBe("cancelled");
  });

  it("emits events to subscribers, including an initial snapshot", () => {
    const { engine, run } = start();
    const events: RunEvent[] = [];
    const unsubscribe = engine.subscribe(run.id, (e) => events.push(e));
    expect(events).toHaveLength(1); // initial snapshot

    vi.advanceTimersByTime(700 + 1000); // start a, complete a, reach gate
    const types = events.map((e) => e.type);
    expect(types).toContain("step");
    expect(events[events.length - 1]!.run.status).toBe("awaiting_approval");

    unsubscribe();
    const count = events.length;
    engine.approve(run.id);
    vi.advanceTimersByTime(5000);
    expect(events.length).toBe(count); // no events after unsubscribe
  });

  it("creates artifacts through the injected callback and links their ids", () => {
    const created: string[] = [];
    const engine = new RunEngine(
      {
        createArtifact: (spec) => {
          created.push(spec.name);
          return `art-${created.length}`;
        },
      },
      1,
    );
    const run = engine.trigger({
      workflow: WF,
      input: {},
      behavior: {
        steps: {
          ...BEHAVIOR.steps,
          a: {
            duration: 1000,
            summary: "a done",
            artifacts: [{ name: "out.py", type: "test_code", content: "x" }],
          },
        },
      },
    });
    vi.advanceTimersByTime(700 + 1000);
    expect(created).toEqual(["out.py"]);
    expect(engine.get(run.id)!.steps[0]!.artifact_ids).toEqual(["art-1"]);
  });

  it("attaches makeOutput on completion and filters list()", () => {
    const engine = new RunEngine({}, 1);
    const run = engine.trigger({
      workflow: { ...WF, steps: [{ name: "a", title: "A" }] },
      input: {},
      behavior: BEHAVIOR,
      makeOutput: () => ({ result: 42 }),
    });
    vi.advanceTimersByTime(700 + 1000);
    expect(engine.get(run.id)!.output).toEqual({ result: 42 });
    expect(engine.list({ status: ["completed"] })).toHaveLength(1);
    expect(engine.list({ status: ["failed"] })).toHaveLength(0);
  });
});
