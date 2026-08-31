import type { WorkflowsClient } from "./WorkflowsClient";
import { MockWorkflowsClient } from "./MockWorkflowsClient";
import { HttpWorkflowsClient } from "./HttpWorkflowsClient";

export type { WorkflowsClient } from "./WorkflowsClient";
export { MockWorkflowsClient } from "./MockWorkflowsClient";
export { HttpWorkflowsClient } from "./HttpWorkflowsClient";
export { WORKFLOWS_SEED, MOCK_BEHAVIOR } from "./seed";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const workflowsClient: WorkflowsClient = useBackend
  ? new HttpWorkflowsClient()
  : new MockWorkflowsClient();
