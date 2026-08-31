import type { WorkflowDef } from "@/lib/contracts";
import type { WorkflowsClient } from "./WorkflowsClient";

/** GET /api/workflows — see BACKEND_API_CONTRACT.md §3.5. Untested stub. */
export class HttpWorkflowsClient implements WorkflowsClient {
  constructor(private readonly basePath = "/api/workflows") {}

  async list(): Promise<WorkflowDef[]> {
    const res = await fetch(this.basePath);
    if (!res.ok) throw new Error(`GET ${this.basePath} failed (HTTP ${res.status})`);
    return (await res.json()) as WorkflowDef[];
  }

  async get(name: string): Promise<WorkflowDef | null> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(name)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET workflow failed (HTTP ${res.status})`);
    return (await res.json()) as WorkflowDef;
  }
}
