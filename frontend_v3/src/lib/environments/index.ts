import type { EnvironmentsClient } from "./EnvironmentsClient";
import { MockEnvironmentsClient } from "./MockEnvironmentsClient";
import { HttpEnvironmentsClient } from "./HttpEnvironmentsClient";

export type { EnvironmentsClient } from "./EnvironmentsClient";
export { MockEnvironmentsClient } from "./MockEnvironmentsClient";
export { HttpEnvironmentsClient } from "./HttpEnvironmentsClient";
export { ENVIRONMENTS_SEED, buildEnvContent } from "./seed";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const environmentsClient: EnvironmentsClient = useBackend
  ? new HttpEnvironmentsClient()
  : new MockEnvironmentsClient();
