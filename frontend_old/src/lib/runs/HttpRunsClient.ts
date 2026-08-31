import type { Run, RunEvent, RunFilter } from "@/lib/contracts";
import type { RunsClient, TriggerOptions } from "./RunsClient";

const POLL_MS = 2000;

/**
 * /api/runs — see BACKEND_API_CONTRACT.md §3.5. Untested stub. `subscribe` is
 * implemented as polling for now; when the backend grows SSE the mechanism
 * changes here and nowhere else.
 */
export class HttpRunsClient implements RunsClient {
  constructor(private readonly basePath = "/api/runs") {}

  async trigger(
    workflowName: string,
    input: Record<string, unknown>,
    options?: TriggerOptions,
  ): Promise<Run> {
    const res = await fetch(this.basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: workflowName,
        input,
        pause_after: options?.pauseAfter,
      }),
    });
    if (!res.ok) throw new Error(`Trigger failed (HTTP ${res.status})`);
    return (await res.json()) as Run;
  }

  async get(runId: string): Promise<Run | null> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(runId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET run failed (HTTP ${res.status})`);
    return (await res.json()) as Run;
  }

  async list(filter?: RunFilter): Promise<Run[]> {
    const params = new URLSearchParams();
    for (const s of filter?.status ?? []) params.append("status", s);
    if (filter?.workflow) params.set("workflow", filter.workflow);
    const qs = params.toString();
    const res = await fetch(qs ? `${this.basePath}?${qs}` : this.basePath);
    if (!res.ok) throw new Error(`GET runs failed (HTTP ${res.status})`);
    return (await res.json()) as Run[];
  }

  async approve(runId: string): Promise<Run> {
    const res = await fetch(
      `${this.basePath}/${encodeURIComponent(runId)}/approve`,
      { method: "POST" },
    );
    if (!res.ok) throw new Error(`Approve failed (HTTP ${res.status})`);
    return (await res.json()) as Run;
  }

  async cancel(runId: string): Promise<Run> {
    const res = await fetch(
      `${this.basePath}/${encodeURIComponent(runId)}/cancel`,
      { method: "POST" },
    );
    if (!res.ok) throw new Error(`Cancel failed (HTTP ${res.status})`);
    return (await res.json()) as Run;
  }

  subscribe(runId: string, onEvent: (event: RunEvent) => void): () => void {
    let lastJson = "";
    let stopped = false;

    const poll = async () => {
      try {
        const run = await this.get(runId);
        if (stopped || !run) return;
        const json = JSON.stringify(run);
        if (json !== lastJson) {
          lastJson = json;
          onEvent({
            run_id: runId,
            ts: Date.now(),
            type: "status",
            message: "Run updated",
            run,
          });
        }
      } catch {
        // transient poll failure — next tick retries
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
}
