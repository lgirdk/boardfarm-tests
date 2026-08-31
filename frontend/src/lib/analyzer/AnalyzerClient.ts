import type { LogAnalysis, PastRunLog } from "@/lib/contracts";

/**
 * Log analyzer seam. `analyze` runs the (server-side) analysis engine over a
 * blob of boardfarm output; the mock reproduces its shape locally.
 */
export interface AnalyzerClient {
  analyze(logText: string): Promise<LogAnalysis>;
  /** Past runs whose captured stdout can be pulled in as input. */
  pastRuns(): Promise<PastRunLog[]>;
  /** A representative sample log to prefill the input. */
  sampleLog(): Promise<string>;
}
