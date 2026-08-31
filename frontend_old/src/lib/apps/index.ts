import type { AppsClient } from "./AppsClient";
import { MockAppsClient } from "./MockAppsClient";
import { HttpAppsClient } from "./HttpAppsClient";
import { runEngine } from "@/lib/runs";

export type { AppsClient } from "./AppsClient";
export { MockAppsClient } from "./MockAppsClient";
export { HttpAppsClient } from "./HttpAppsClient";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const appsClient: AppsClient = useBackend
  ? new HttpAppsClient()
  : new MockAppsClient(runEngine);
