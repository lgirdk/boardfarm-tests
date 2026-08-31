import type { PersistenceAdapter } from "./PersistenceAdapter";
import { MockAdapter } from "./MockAdapter";
import { HttpAdapter } from "./HttpAdapter";

export type {
  PersistenceAdapter,
  ConfigFileId,
  ConfigDoc,
  SaveResult,
  ValidationIssue,
} from "./PersistenceAdapter";

/**
 * Single place that selects the active adapter. Defaults to MockAdapter
 * (instant, in-memory) so the UI works with no backend; set VITE_USE_BACKEND=1
 * to hit the real FastAPI. Single switch point — nothing else changes.
 *
 * To exercise loading/saving spinners without a backend, swap MockAdapter for
 * MockHttpAdapter (simulated latency).
 */
const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const persistence: PersistenceAdapter = useBackend
  ? new HttpAdapter()
  : new MockAdapter();
