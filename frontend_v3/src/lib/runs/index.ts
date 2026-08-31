import type { RunsClient } from "./RunsClient";
import { RunEngine } from "./engine";
import { MockRunsClient } from "./MockRunsClient";
import { HttpRunsClient } from "./HttpRunsClient";
import { HISTORICAL_RUNS, RUN_COUNTER_START } from "./seed";
import { MOCK_BEHAVIOR, type WorkflowBehavior } from "@/lib/workflows/seed";
import { artifactStore } from "@/lib/artifacts/artifactStore";
import type { Run, WorkflowDef } from "@/lib/contracts";

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

/**
 * One RunSpec → one Run, for everything. A quick run, a suite run and a
 * pipeline's execute step all build the same shape. The boardfarm phase list is
 * derived here: flash / factory-reset are only present when requested, so the
 * run detail can show them as real phases (and skipped when omitted).
 */
export interface LaunchSpec {
  testIds: string[];
  testNames: string[];
  boardModel: string;
  bedId?: string;
  envName: string;
  flashFirmware: boolean;
  factoryReset: boolean;
}

export function launchRun(spec: LaunchSpec): Run {
  const steps: WorkflowDef["steps"] = [
    { name: "reserve", title: "Reserve bed", label: "boardfarm" },
  ];
  if (spec.flashFirmware)
    steps.push({ name: "flash", title: "Flash firmware", label: "boardfarm" });
  if (spec.factoryReset)
    steps.push({ name: "factory_reset", title: "Factory reset", label: "boardfarm" });
  steps.push(
    { name: "provision", title: "Provision environment", label: "boardfarm" },
    { name: "execute", title: "Execute tests", label: "pytest" },
    { name: "collect", title: "Collect artifacts", label: "boardfarm" },
    { name: "release", title: "Release bed", label: "boardfarm" },
  );

  const bed = spec.bedId ?? `${spec.boardModel}-auto`;
  const workflow: WorkflowDef = {
    name: "test-run",
    title: "Test run",
    description: "",
    steps,
    input_descriptor: [],
  };
  const behavior: WorkflowBehavior = {
    steps: {
      reserve: {
        duration: 2200,
        summary: `${bed} reserved`,
        details: {
          bed,
          board: spec.boardModel,
          reservation: `resv-${Math.floor(Math.random() * 9000 + 1000)}`,
        },
      },
      flash: {
        duration: 9000,
        summary: "image written to bank B",
        details: {
          image: `ofw-${spec.boardModel.toLowerCase()}-r18-20250812.bin`,
          strategy: "meta_build",
        },
      },
      factory_reset: { duration: 3000, summary: "factory reset complete" },
      provision: {
        duration: 3600,
        summary: "eRouter online",
        details: { prov_mode: "dual", cmts: "CC8800", erouter_ipv4: "172.25.1.114" },
      },
      execute: {
        duration: 6000,
        summary: `${spec.testIds.length} passed`,
        details: { runner: "pytest-boardfarm3", result: `${spec.testIds.length} passed` },
      },
      collect: { duration: 1500, summary: "3 artifacts collected" },
      release: { duration: 1400, summary: "bed released" },
    },
  };

  return runEngine.trigger({
    workflow,
    input: {
      tests: spec.testIds,
      test_names: spec.testNames,
      test_count: spec.testIds.length,
      board_model: spec.boardModel,
      bed,
      env_name: spec.envName,
      flash: spec.flashFirmware,
      reset: spec.factoryReset,
    },
    behavior,
    triggeredBy: "you",
  });
}
