import type { WorkflowDef } from "@/lib/contracts";
import type { WorkflowsClient } from "./WorkflowsClient";
import { WORKFLOWS_SEED } from "./seed";

/** In-browser workflow catalog (deep-cloned so callers can't mutate the seed). */
export class MockWorkflowsClient implements WorkflowsClient {
  constructor(
    private readonly seed: WorkflowDef[] = WORKFLOWS_SEED,
    private readonly delayMs = 120,
  ) {}

  async list(): Promise<WorkflowDef[]> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    return structuredClone(this.seed);
  }

  async get(name: string): Promise<WorkflowDef | null> {
    const all = await this.list();
    return all.find((w) => w.name === name) ?? null;
  }
}
