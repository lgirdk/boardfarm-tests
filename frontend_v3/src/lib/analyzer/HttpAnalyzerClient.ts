import type { LogAnalysis, PastRunLog } from "@/lib/contracts";
import type { AnalyzerClient } from "./AnalyzerClient";

/** /api/analyzer/* — see docs/BACKEND_API_CONTRACT.md. Untested stub. */
export class HttpAnalyzerClient implements AnalyzerClient {
  constructor(private readonly basePath = "/api/analyzer") {}

  async analyze(logText: string): Promise<LogAnalysis> {
    const res = await fetch(`${this.basePath}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log: logText }),
    });
    if (!res.ok) throw new Error(`Analyze failed (HTTP ${res.status})`);
    return (await res.json()) as LogAnalysis;
  }

  async pastRuns(): Promise<PastRunLog[]> {
    const res = await fetch(`${this.basePath}/past-runs`);
    if (!res.ok) throw new Error(`GET past-runs failed (HTTP ${res.status})`);
    return (await res.json()) as PastRunLog[];
  }

  async sampleLog(): Promise<string> {
    const res = await fetch(`${this.basePath}/sample`);
    if (!res.ok) throw new Error(`GET sample failed (HTTP ${res.status})`);
    return (await res.json()) as string;
  }
}
