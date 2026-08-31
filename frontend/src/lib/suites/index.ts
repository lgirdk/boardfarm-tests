import type { SuitesClient } from "./SuitesClient";
import { MockSuitesClient } from "./MockSuitesClient";
import { HttpSuitesClient } from "./HttpSuitesClient";

export type { SuitesClient } from "./SuitesClient";
export { MockSuitesClient } from "./MockSuitesClient";
export { HttpSuitesClient } from "./HttpSuitesClient";
export { SUITES_SEED } from "./seed";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const suitesClient: SuitesClient = useBackend
  ? new HttpSuitesClient()
  : new MockSuitesClient();
