import type { Schedule } from "@/lib/contracts";
import type { SchedulesClient } from "./SchedulesClient";
import { SCHEDULES_SEED } from "./seed";

export class MockSchedulesClient implements SchedulesClient {
  private store: Schedule[] = structuredClone(SCHEDULES_SEED);

  async list(): Promise<Schedule[]> {
    await new Promise((r) => setTimeout(r, 100));
    return structuredClone(this.store);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const s = this.store.find((x) => x.id === id);
    if (s) {
      s.enabled = enabled;
      s.next = enabled ? "recomputing…" : "paused";
    }
  }
}
