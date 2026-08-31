import { useCallback, useState } from "react";

/**
 * Generic lifecycle for "invoke a backend operation and watch it run".
 *
 * Today operations are synchronous request/response (the codegen endpoint blocks
 * until done), so this is a thin wrapper over a Promise. When the backend grows
 * an async job API (submit → poll/stream), the same hook can drive polling
 * without any caller changes — the seam stays here.
 */
export type RunStatus = "idle" | "running" | "success" | "error";

export interface RunState<TOutput> {
  status: RunStatus;
  result?: TOutput;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface UseRun<TInput, TOutput> {
  state: RunState<TOutput>;
  /** Kick off the operation. Resolves to the final state (never throws). */
  run: (input: TInput) => Promise<RunState<TOutput>>;
  reset: () => void;
}

export function useRun<TInput, TOutput>(
  operation: (input: TInput) => Promise<TOutput>,
): UseRun<TInput, TOutput> {
  const [state, setState] = useState<RunState<TOutput>>({ status: "idle" });

  const run = useCallback(
    async (input: TInput): Promise<RunState<TOutput>> => {
      const startedAt = Date.now();
      setState({ status: "running", startedAt });
      try {
        const result = await operation(input);
        const next: RunState<TOutput> = {
          status: "success",
          result,
          startedAt,
          finishedAt: Date.now(),
        };
        setState(next);
        return next;
      } catch (err) {
        const next: RunState<TOutput> = {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          startedAt,
          finishedAt: Date.now(),
        };
        setState(next);
        return next;
      }
    },
    [operation],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}
