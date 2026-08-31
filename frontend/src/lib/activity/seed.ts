import type { ActivityItem } from "@/lib/contracts";

/**
 * Seed team activity entries. Replace with real data by wiring
 * HttpActivityClient to the backend audit-log API.
 */
export const ACTIVITY_SEED: ActivityItem[] = [
  { actor: "s.byrne", verb: "published", target: "test_dns_ipv6_lan" },
  { actor: "j.okafor", verb: "generated 2 drafts" },
];
