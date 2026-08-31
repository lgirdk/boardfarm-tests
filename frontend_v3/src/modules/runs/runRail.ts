import type { Run, StepState } from "@/lib/contracts";
import { fmtDuration } from "@/lib/time";

/**
 * Pure derivation of the vertical run rail from a Run — kept out of the
 * component so it's unit-testable. One node per step: visual state + the
 * one-line summary/duration shown under the step name.
 */

export type RailState =
  | "done"
  | "running"
  | "awaiting"
  | "failed"
  | "pending"
  | "skipped";

export interface RailNode {
  name: string;
  title: string;
  /** Optional backend display hint (e.g. "jenkins"). */
  label?: string;
  state: RailState;
  /** One-liner under the step: summary · duration, or a state hint. */
  detail: string;
}

const STATE_MAP: Record<StepState, RailState> = {
  completed: "done",
  running: "running",
  awaiting_approval: "awaiting",
  failed: "failed",
  pending: "pending",
  skipped: "skipped",
};

export function deriveRail(run: Run): RailNode[] {
  return run.steps.map((step) => {
    const state = STATE_MAP[step.state];
    let detail: string;
    switch (state) {
      case "done": {
        const duration =
          step.started_at && step.finished_at
            ? fmtDuration(step.finished_at - step.started_at)
            : undefined;
        detail = [step.summary, duration].filter(Boolean).join(" · ") || "done";
        break;
      }
      case "running":
        detail = "in progress";
        break;
      case "awaiting":
        detail = "waiting on you";
        break;
      case "failed":
        detail = run.error?.step === step.name ? "failed here" : "failed";
        break;
      case "skipped":
        detail = "skipped";
        break;
      default:
        detail = step.summary ?? "pending";
    }
    return {
      name: step.name,
      title: step.title,
      label: step.label,
      state,
      detail,
    };
  });
}

/** The step the detail panel should focus by default. */
export function defaultFocusStep(run: Run): string | undefined {
  const byPriority =
    run.steps.find((s) => s.state === "awaiting_approval") ??
    run.steps.find((s) => s.state === "failed") ??
    run.steps.find((s) => s.state === "running") ??
    [...run.steps].reverse().find((s) => s.state === "completed");
  return byPriority?.name ?? run.steps[0]?.name;
}
