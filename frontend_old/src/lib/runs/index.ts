import type { RunsClient } from "./RunsClient";
import { RunEngine } from "./engine";
import { MockRunsClient } from "./MockRunsClient";
import { HttpRunsClient } from "./HttpRunsClient";
import { HISTORICAL_RUNS, RUN_COUNTER_START } from "./seed";
import { MOCK_BEHAVIOR } from "@/lib/workflows/seed";
import { artifactStore } from "@/lib/artifacts/artifactStore";

export type { RunsClient, TriggerOptions } from "./RunsClient";
export { RunEngine, isTerminal } from "./engine";
export { MockRunsClient } from "./MockRunsClient";
export { HttpRunsClient } from "./HttpRunsClient";
export { HISTORICAL_RUNS } from "./seed";

/**
 * The shared engine singleton: seeded with history, wired so that steps which
 * produce artifacts write them into the shared artifact store. Also used by
 * the mock AppsClient so app invocations appear in Runs.
 */
export const runEngine = new RunEngine(
  {
    createArtifact: (spec, run, stepName) =>
      artifactStore.create({
        name: spec.name,
        type: spec.type,
        language: spec.language,
        content: spec.content,
        workspace: run.workspace,
        run_id: run.id,
        step: stepName,
      }).id,
  },
  RUN_COUNTER_START,
);

for (const run of HISTORICAL_RUNS) {
  runEngine.seed(structuredClone(run), MOCK_BEHAVIOR[run.workflow]);
}

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const runsClient: RunsClient = useBackend
  ? new HttpRunsClient()
  : new MockRunsClient(runEngine);
