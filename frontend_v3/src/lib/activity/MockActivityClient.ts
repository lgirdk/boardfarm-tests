import type { ActivityItem } from "@/lib/contracts";
import type { ActivityClient } from "./ActivityClient";
import { ACTIVITY_SEED } from "./seed";

export class MockActivityClient implements ActivityClient {
  async teamActivity(): Promise<ActivityItem[]> {
    await new Promise((r) => setTimeout(r, 80));
    return structuredClone(ACTIVITY_SEED);
  }
}
