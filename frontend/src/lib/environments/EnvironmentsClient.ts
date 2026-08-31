import type { EnvConfig, EnvFilter } from "@/lib/contracts";

/**
 * Environment descriptors — reusable provisioning configs (environment_def).
 * Browsed/managed in the Environments catalog and selected inline during a run.
 * `suggestForEnvReq` powers the run picker: given a test's env_req marker, it
 * returns compatible envs so the user never hand-writes JSON.
 */
export interface EnvironmentsClient {
  list(filter?: EnvFilter): Promise<EnvConfig[]>;
  get(id: string): Promise<EnvConfig | undefined>;
  /** Create or update (mock: in-memory). */
  save(env: EnvConfig): Promise<EnvConfig>;
  /** Envs whose tags satisfy a test's env_req (optionally for a board model). */
  suggestForEnvReq(envReq: string, boardModel?: string): Promise<EnvConfig[]>;
}
