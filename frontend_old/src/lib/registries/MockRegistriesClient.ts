import type { Registries, RegistriesClient } from "./RegistriesClient";
import { REGISTRIES_SEED } from "./seed";

/**
 * In-browser stand-in for GET /api/registries. Returns the seeded catalog
 * after a short delay so loading states are visible during development.
 *
 * Drop-in replaceable by HttpRegistriesClient via VITE_USE_BACKEND=1.
 */
export class MockRegistriesClient implements RegistriesClient {
  constructor(
    private readonly seed: Registries = REGISTRIES_SEED,
    private readonly delayMs = 150,
  ) {}

  async fetch(): Promise<Registries> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    // Return a deep clone so callers can't mutate the seed.
    return structuredClone(this.seed);
  }
}
