import type { Schedule } from "@/lib/contracts";
import type { SchedulesClient } from "./SchedulesClient";

/**
 * /api/schedules — see BACKEND_API_CONTRACT.md. Untested stub; wire when the
 * backend scheduler is ready.
 */
export class HttpSchedulesClient implements SchedulesClient {
  constructor(private readonly basePath = "/api/schedules") {}

  async list(): Promise<Schedule[]> {
    const res = await fetch(this.basePath);
    if (!res.ok) throw new Error(`GET schedules failed (HTTP ${res.status})`);
    return (await res.json()) as Schedule[];
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(id)}/enabled`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(`Set schedule enabled failed (HTTP ${res.status})`);
  }
}
