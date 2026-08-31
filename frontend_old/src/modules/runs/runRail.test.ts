import { describe, expect, it } from "vitest";
import type { Run } from "@/lib/contracts";
import { defaultFocusStep, deriveRail } from "./runRail";

function makeRun(states: Run["steps"][number]["state"][]): Run {
  return {
    id: "r-0001",
    workflow: "wf",
    workflow_title: "WF",
    status: "running",
    triggered_by: "you",
    workspace: "ws",
    created_at: 0,
    steps: states.map((state, i) => ({
      name: `s${i}`,
      title: `S${i}`,
      state,
      started_at: state !== "pending" ? 1000 : undefined,
      finished_at: state === "completed" ? 43_000 : undefined,
      summary: state === "completed" ? "12 done" : undefined,
    })),
  };
}

describe("deriveRail", () => {
  it("maps step states to rail states", () => {
    const rail = deriveRail(
      makeRun(["completed", "running", "awaiting_approval", "failed", "pending", "skipped"]),
    );
    expect(rail.map((n) => n.state)).toEqual([
      "done",
      "running",
      "awaiting",
      "failed",
      "pending",
      "skipped",
    ]);
  });

  it("builds the summary · duration line for completed steps", () => {
    const rail = deriveRail(makeRun(["completed"]));
    expect(rail[0]!.detail).toBe("12 done · 42s");
  });

  it("labels awaiting steps as waiting on you", () => {
    const rail = deriveRail(makeRun(["completed", "awaiting_approval"]));
    expect(rail[1]!.detail).toBe("waiting on you");
  });
});

describe("defaultFocusStep", () => {
  it("prefers awaiting > failed > running > last completed", () => {
    expect(defaultFocusStep(makeRun(["completed", "awaiting_approval", "running"]))).toBe("s1");
    expect(defaultFocusStep(makeRun(["completed", "failed"]))).toBe("s1");
    expect(defaultFocusStep(makeRun(["completed", "running", "pending"]))).toBe("s1");
    expect(defaultFocusStep(makeRun(["completed", "completed", "pending"]))).toBe("s1");
    expect(defaultFocusStep(makeRun(["pending", "pending"]))).toBe("s0");
  });
});
