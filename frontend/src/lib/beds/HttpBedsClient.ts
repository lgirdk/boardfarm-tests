import type { Bed, BoardTypeAvailability } from "@/lib/contracts";
import type { BedsClient } from "./BedsClient";

/**
 * /api/beds — see BACKEND_API_CONTRACT.md. Untested stub; wire when the
 * backend bed-status bridge is ready.
 */
export class HttpBedsClient implements BedsClient {
  constructor(private readonly basePath = "/api/beds") {}

  async list(): Promise<Bed[]> {
    const res = await fetch(this.basePath);
    if (!res.ok) throw new Error(`GET beds failed (HTTP ${res.status})`);
    return (await res.json()) as Bed[];
  }

  async availability(): Promise<BoardTypeAvailability[]> {
    const res = await fetch(`${this.basePath}/availability`);
    if (!res.ok) throw new Error(`GET bed availability failed (HTTP ${res.status})`);
    return (await res.json()) as BoardTypeAvailability[];
  }
}
