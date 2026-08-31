import type { WorkflowDef } from "@/lib/contracts";

/**
 * Workflow catalog seam. Workflows (names, steps, gateways, input fields) are
 * DATA served by this client — nothing in a component may hardcode them.
 */
export interface WorkflowsClient {
  list(): Promise<WorkflowDef[]>;
  get(name: string): Promise<WorkflowDef | null>;
}
