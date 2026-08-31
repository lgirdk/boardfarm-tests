import type { EnvConfig, EnvFilter } from "@/lib/contracts";
import type { EnvironmentsClient } from "./EnvironmentsClient";

/**
 * /api/environments — see BACKEND_API_CONTRACT.md. Untested stub; wire when
 * the backend environment store is ready.
 */
export class HttpEnvironmentsClient implements EnvironmentsClient {
  constructor(private readonly basePath = "/api/environments") {}

  async list(filter?: EnvFilter): Promise<EnvConfig[]> {
    const params = new URLSearchParams();
    if (filter?.board_model) params.set("board_model", filter.board_model);
    if (filter?.visibility) params.set("visibility", filter.visibility);
    const qs = params.toString();
    const res = await fetch(qs ? `${this.basePath}?${qs}` : this.basePath);
    if (!res.ok) throw new Error(`GET environments failed (HTTP ${res.status})`);
    return (await res.json()) as EnvConfig[];
  }

  async get(id: string): Promise<EnvConfig | undefined> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`GET environment failed (HTTP ${res.status})`);
    return (await res.json()) as EnvConfig;
  }

  async save(env: EnvConfig): Promise<EnvConfig> {
    const res = await fetch(this.basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(env),
    });
    if (!res.ok) throw new Error(`Save environment failed (HTTP ${res.status})`);
    return (await res.json()) as EnvConfig;
  }

  async suggestForEnvReq(envReq: string, boardModel?: string): Promise<EnvConfig[]> {
    const params = new URLSearchParams({ env_req: envReq });
    if (boardModel) params.set("board_model", boardModel);
    const res = await fetch(`${this.basePath}/suggest?${params}`);
    if (!res.ok) throw new Error(`Suggest environments failed (HTTP ${res.status})`);
    return (await res.json()) as EnvConfig[];
  }
}
