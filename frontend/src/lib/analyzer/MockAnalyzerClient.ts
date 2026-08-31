import type { LogAnalysis, PastRunLog } from "@/lib/contracts";
import type { AnalyzerClient } from "./AnalyzerClient";
import { analyzeLog } from "./analyze";
import { PAST_RUN_LOGS, SAMPLE_LOG } from "./seed";

/** Local analyzer — keyword engine + seeded sample/past-run logs. */
export class MockAnalyzerClient implements AnalyzerClient {
  async analyze(logText: string): Promise<LogAnalysis> {
    await new Promise((r) => setTimeout(r, 220));
    return analyzeLog(logText);
  }

  async pastRuns(): Promise<PastRunLog[]> {
    return structuredClone(PAST_RUN_LOGS);
  }

  async sampleLog(): Promise<string> {
    return SAMPLE_LOG;
  }
}
