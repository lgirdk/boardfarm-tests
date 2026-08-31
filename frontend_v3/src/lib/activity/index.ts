import type { ActivityClient } from "./ActivityClient";
import { MockActivityClient } from "./MockActivityClient";
import { HttpActivityClient } from "./HttpActivityClient";

export type { ActivityClient } from "./ActivityClient";
export { MockActivityClient } from "./MockActivityClient";
export { HttpActivityClient } from "./HttpActivityClient";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const activityClient: ActivityClient = useBackend
  ? new HttpActivityClient()
  : new MockActivityClient();
