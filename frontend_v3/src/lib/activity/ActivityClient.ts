import type { ActivityItem } from "@/lib/contracts";

/**
 * Team activity feed shown in the dashboard right rail. The mock returns
 * seeded entries; the real backend aggregates from audit logs.
 */
export interface ActivityClient {
  teamActivity(): Promise<ActivityItem[]>;
}
