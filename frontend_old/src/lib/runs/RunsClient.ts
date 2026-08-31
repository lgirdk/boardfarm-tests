import type { Run, RunEvent, RunFilter } from "@/lib/contracts";

export interface TriggerOptions {
  /** Step names after which the run pauses for approval (user-requested). */
  pauseAfter?: string[];
  triggeredBy?: string;
}

/**
 * Runs seam. `subscribe` hides the live-update mechanism: the mock emits from
 * its timer engine; the HTTP client polls (later SSE) — callers can't tell.
 */
export interface RunsClient {
  trigger(
    workflowName: string,
    input: Record<string, unknown>,
    options?: TriggerOptions,
  ): Promise<Run>;
  get(runId: string): Promise<Run | null>;
  list(filter?: RunFilter): Promise<Run[]>;
  approve(runId: string): Promise<Run>;
  cancel(runId: string): Promise<Run>;
  /** Emits an initial snapshot, then every change. Returns unsubscribe. */
  subscribe(runId: string, onEvent: (event: RunEvent) => void): () => void;
}
