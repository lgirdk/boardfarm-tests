import type { Registries, RegistriesClient } from "./RegistriesClient";

/**
 * Calls the real backend endpoint GET /api/registries (see
 * frontend/docs/BACKEND_API_CONTRACT.md §3.1). In dev, Vite proxies `/api`
 * to http://localhost:8080 (see vite.config.ts) so the URL is same-origin
 * relative.
 */
export class HttpRegistriesClient implements RegistriesClient {
  constructor(private readonly basePath = "/api") {}

  async fetch(): Promise<Registries> {
    const res = await fetch(`${this.basePath}/registries`);
    if (!res.ok) {
      throw new Error(
        `GET ${this.basePath}/registries failed (HTTP ${res.status})`,
      );
    }
    return (await res.json()) as Registries;
  }
}
