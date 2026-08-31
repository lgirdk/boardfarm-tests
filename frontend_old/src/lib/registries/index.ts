import type { RegistriesClient } from "./RegistriesClient";
import { MockRegistriesClient } from "./MockRegistriesClient";
import { HttpRegistriesClient } from "./HttpRegistriesClient";

export type {
  RegistriesClient,
  Registries,
  LlmClientEntry,
} from "./RegistriesClient";
export { REGISTRIES_SEED } from "./seed";
export { RegistriesProvider, useRegistries } from "./RegistriesContext";
export { MockRegistriesClient } from "./MockRegistriesClient";
export { HttpRegistriesClient } from "./HttpRegistriesClient";

/**
 * The active registries client. Defaults to the mock so the UI works with no
 * backend; set VITE_USE_BACKEND=1 to hit the real FastAPI. Single switch
 * point — nothing else changes.
 */
const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const registriesClient: RegistriesClient = useBackend
  ? new HttpRegistriesClient()
  : new MockRegistriesClient();
