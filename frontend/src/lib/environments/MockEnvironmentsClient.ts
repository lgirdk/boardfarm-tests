import type { EnvConfig, EnvFilter } from "@/lib/contracts";
import type { EnvironmentsClient } from "./EnvironmentsClient";
import { ENVIRONMENTS_SEED } from "./seed";

/** In-browser environment catalog with an in-memory mutable store. */
export class MockEnvironmentsClient implements EnvironmentsClient {
  private store: EnvConfig[];

  constructor(seed: EnvConfig[] = ENVIRONMENTS_SEED, private readonly delayMs = 120) {
    this.store = structuredClone(seed);
  }

  private async delay() {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
  }

  async list(filter?: EnvFilter): Promise<EnvConfig[]> {
    await this.delay();
    let all = structuredClone(this.store);
    if (filter?.board_model)
      all = all.filter((e) => e.board_model === filter.board_model);
    if (filter?.visibility)
      all = all.filter((e) => e.visibility === filter.visibility);
    return all.sort((a, b) => b.updated_at - a.updated_at);
  }

  async get(id: string): Promise<EnvConfig | undefined> {
    await this.delay();
    const found = this.store.find((e) => e.id === id);
    return found ? structuredClone(found) : undefined;
  }

  async save(env: EnvConfig): Promise<EnvConfig> {
    await this.delay();
    const next = { ...env, updated_at: Date.now() };
    const idx = this.store.findIndex((e) => e.id === env.id);
    if (idx >= 0) this.store[idx] = next;
    else this.store.unshift(next);
    return structuredClone(next);
  }

  async suggestForEnvReq(
    envReq: string,
    boardModel?: string,
  ): Promise<EnvConfig[]> {
    const all = await this.list(
      boardModel ? { board_model: boardModel } : undefined,
    );
    const req = envReq.trim().toLowerCase();
    // Exact tag match first, then envs that at least share the prov mode.
    const exact = all.filter((e) => e.env_tags.includes(req));
    if (exact.length) return exact;
    return all.filter((e) => e.env_tags.some((t) => t === req));
  }
}
