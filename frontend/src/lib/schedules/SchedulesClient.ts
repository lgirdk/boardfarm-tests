import type { Schedule } from "@/lib/contracts";

/** Scheduled runs (a saved RunSpec with a cron). Mock is in-memory. */
export interface SchedulesClient {
  list(): Promise<Schedule[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
}
