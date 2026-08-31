import type { TestsClient } from "./TestsClient";
import { MockTestsClient } from "./MockTestsClient";
import { HttpTestsClient } from "./HttpTestsClient";

export type { TestsClient } from "./TestsClient";
export { MockTestsClient } from "./MockTestsClient";
export { HttpTestsClient } from "./HttpTestsClient";
export { TESTS_SEED } from "./seed";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const testsClient: TestsClient = useBackend
  ? new HttpTestsClient()
  : new MockTestsClient();
