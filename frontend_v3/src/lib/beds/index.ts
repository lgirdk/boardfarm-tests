import type { BedsClient } from "./BedsClient";
import { MockBedsClient } from "./MockBedsClient";
import { HttpBedsClient } from "./HttpBedsClient";

export type { BedsClient } from "./BedsClient";
export { MockBedsClient } from "./MockBedsClient";
export { HttpBedsClient } from "./HttpBedsClient";
export { BEDS_SEED } from "./seed";
export { parseStationFile } from "./inventoryParser";
export type { ImportResult } from "./inventoryParser";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const bedsClient: BedsClient = useBackend
  ? new HttpBedsClient()
  : new MockBedsClient();
