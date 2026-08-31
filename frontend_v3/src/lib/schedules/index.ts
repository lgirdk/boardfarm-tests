import type { SchedulesClient } from "./SchedulesClient";
import { MockSchedulesClient } from "./MockSchedulesClient";
import { HttpSchedulesClient } from "./HttpSchedulesClient";

export type { SchedulesClient } from "./SchedulesClient";
export { MockSchedulesClient } from "./MockSchedulesClient";
export { HttpSchedulesClient } from "./HttpSchedulesClient";
export { SCHEDULES_SEED } from "./seed";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const schedulesClient: SchedulesClient = useBackend
  ? new HttpSchedulesClient()
  : new MockSchedulesClient();
