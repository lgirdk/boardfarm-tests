import type { ActivityItem } from "@/lib/contracts";
import type { ActivityClient } from "./ActivityClient";

/**
 * /api/activity — see BACKEND_API_CONTRACT.md. Untested stub; wire when the
 * backend audit-log aggregation is ready.
 */
export class HttpActivityClient implements ActivityClient {
  constructor(private readonly basePath = "/api/activity") {}

  async teamActivity(): Promise<ActivityItem[]> {
    const res = await fetch(`${this.basePath}/team`);
    if (!res.ok) throw new Error(`GET team activity failed (HTTP ${res.status})`);
    return (await res.json()) as ActivityItem[];
  }
}
