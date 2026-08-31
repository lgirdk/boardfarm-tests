import type { Run, RunStatus, RunStep, StepState } from "@/lib/contracts";
import { WORKFLOWS_SEED } from "@/lib/workflows/seed";

/**
 * ~10 historical runs across all statuses so lists/filters/detail are real on
 * first load. Two are `awaiting_approval` — approving them live-resumes their
 * timers through the engine. Ids run r-0131…r-0141; the engine's counter
 * continues from 142.
 */

const now = Date.now();
const m = 60_000;

interface StepSpec {
  state: StepState;
  summary?: string;
  artifact_ids?: string[];
  details?: Record<string, string>;
}

function makeRun(args: {
  id: string;
  workflow: string;
  status: RunStatus;
  ageMin: number;
  durationMin?: number;
  triggeredBy: string;
  steps: Record<string, StepSpec>;
  error?: { step: string; message: string };
}): Run {
  const def = WORKFLOWS_SEED.find((w) => w.name === args.workflow);
  if (!def) throw new Error(`seed: unknown workflow ${args.workflow}`);
  const created = now - args.ageMin * m;
  const steps: RunStep[] = def.steps.map((s): RunStep => {
    const spec = args.steps[s.name] ?? { state: "pending" as StepState };
    return {
      name: s.name,
      title: s.title,
      approval: s.approval,
      label: s.label,
      state: spec.state,
      summary: spec.summary ?? s.summary,
      artifact_ids: spec.artifact_ids,
      details: spec.details,
      started_at: spec.state !== "pending" ? created : undefined,
      finished_at:
        spec.state === "completed" || spec.state === "failed"
          ? created + 2 * m
          : undefined,
    };
  });
  const terminal =
    args.status === "completed" ||
    args.status === "failed" ||
    args.status === "cancelled";
  return {
    id: args.id,
    workflow: def.name,
    workflow_title: def.title,
    status: args.status,
    triggered_by: args.triggeredBy,
    workspace: "docsis-team",
    created_at: created,
    started_at: created,
    finished_at: terminal
      ? created + (args.durationMin ?? 6) * m
      : undefined,
    steps,
    current_step:
      steps.find(
        (s) => s.state === "awaiting_approval" || s.state === "running",
      )?.name ?? undefined,
    error: args.error,
  };
}

/* Test executions (workflow "test-run") — the boardfarm phase layout the run
 * detail renders richly (phase strip + tests + board + console). Seeded terminal
 * so opening any listed run shows full data, not a bare rail. */
const EXEC_ORDER = [
  "reserve",
  "flash",
  "factory_reset",
  "provision",
  "execute",
  "collect",
  "release",
] as const;
const EXEC_META: Record<(typeof EXEC_ORDER)[number], { title: string; label: string; ms: number }> = {
  reserve: { title: "Reserve bed", label: "boardfarm", ms: 12_000 },
  flash: { title: "Flash firmware", label: "boardfarm", ms: 245_000 },
  factory_reset: { title: "Factory reset", label: "boardfarm", ms: 180_000 },
  provision: { title: "Provision environment", label: "boardfarm", ms: 169_000 },
  execute: { title: "Execute tests", label: "pytest", ms: 0 },
  collect: { title: "Collect artifacts", label: "boardfarm", ms: 90_000 },
  release: { title: "Release bed", label: "boardfarm", ms: 84_000 },
};

interface ExecSpec {
  id: string;
  names: string[];
  boardModel: string;
  bed: string;
  env: string;
  ageMin: number;
  durationMin: number;
  triggeredBy: string;
  status: "completed" | "failed";
  flash?: boolean;
  reset?: boolean;
  error?: { step: string; message: string };
}

function makeExecution(s: ExecSpec): Run {
  const created = now - s.ageMin * m;
  const flashOn = s.flash ?? false;
  const resetOn = s.reset ?? false;
  const setupMs =
    EXEC_META.reserve.ms +
    (flashOn ? EXEC_META.flash.ms : 0) +
    (resetOn ? EXEC_META.factory_reset.ms : 0) +
    EXEC_META.provision.ms +
    EXEC_META.collect.ms +
    EXEC_META.release.ms;
  const executeMs = Math.max(60_000, s.durationMin * m - setupMs);
  const passed = Math.max(0, s.names.length - 1);

  let cursor = created;
  const steps: RunStep[] = EXEC_ORDER.map((name): RunStep => {
    const off = (name === "flash" && !flashOn) || (name === "factory_reset" && !resetOn);
    const failedHere = s.status === "failed" && name === "execute";
    const state: StepState = off ? "skipped" : failedHere ? "failed" : "completed";
    const ms = name === "execute" ? executeMs : EXEC_META[name].ms;
    const started = off ? undefined : cursor;
    const finished = off ? undefined : cursor + ms;
    if (!off) cursor += ms;

    const details: Record<string, string> | undefined =
      name === "reserve"
        ? { bed: s.bed, board: s.boardModel, reservation: `resv-${8800 + s.names.length}` }
        : name === "flash" && flashOn
          ? { image: `ofw-${s.boardModel.toLowerCase()}-r18-20250812.bin`, strategy: "meta_build" }
          : name === "provision"
            ? { prov_mode: "dual", cmts: "CC8800" }
            : name === "execute"
              ? {
                  runner: "pytest-boardfarm3",
                  result: s.status === "failed" ? `${passed} passed · 1 failed` : `${s.names.length} passed`,
                }
              : undefined;
    const summary =
      name === "reserve"
        ? `${s.bed} reserved`
        : name === "flash"
          ? "image written to bank B"
          : name === "factory_reset"
            ? "factory reset complete"
            : name === "provision"
              ? "eRouter online"
              : name === "execute"
                ? s.status === "failed"
                  ? `${passed} passed · 1 failed`
                  : `${s.names.length} passed`
                : name === "collect"
                  ? "3 artifacts collected"
                  : "bed released";

    return {
      name,
      title: EXEC_META[name].title,
      label: EXEC_META[name].label,
      state,
      summary,
      details,
      started_at: started,
      finished_at: finished,
    };
  });

  return {
    id: s.id,
    workflow: "test-run",
    workflow_title: "Test run",
    status: s.status,
    triggered_by: s.triggeredBy,
    workspace: "docsis-team",
    created_at: created,
    started_at: created,
    finished_at: created + s.durationMin * m,
    steps,
    input: {
      tests: s.names.map((n) => `boardfarm/tests/${n}`),
      test_names: s.names,
      test_count: s.names.length,
      board_model: s.boardModel,
      bed: s.bed,
      env_name: s.env,
      flash: flashOn,
      reset: resetOn,
    },
    error: s.error,
  };
}

const JENKINS_PASS = {
  build: "#4207",
  bed: "docsis-31-b2",
  board: "DEMO_X1",
  image: "6.2.1-release",
  result: "12 passed",
};

export const HISTORICAL_RUNS: Run[] = [
  // Voice smoke, 3 tests, finished green — the full boardfarm phase layout.
  makeExecution({
    id: "r-0142",
    names: [
      "test_voice_call_fxs_to_fxs",
      "test_voice_rtp_codec_g711a",
      "test_voice_call_hold_resume",
    ],
    boardModel: "F3896LG",
    bed: "F3896LG-2-1",
    env: "env-ch7465-upc-dual-voice",
    ageMin: 38,
    durationMin: 41,
    triggeredBy: "ahazra",
    status: "completed",
    flash: true,
  }),
  // SNMP + networking regression, 4 tests, green (flashed first).
  makeExecution({
    id: "r-0144",
    names: [
      "test_snmp_docsdevfilter_walk",
      "test_MVX_TST_1985",
      "test_snmp_sysdescr_fields",
      "test_wan_ipv4_after_reboot",
    ],
    boardModel: "F3896LG",
    bed: "F3896LG-2-1",
    env: "env-f3896-sunrise-wifi5-tr069",
    ageMin: 3,
    durationMin: 24,
    triggeredBy: "ahazra",
    status: "completed",
    flash: true,
  }),
  // Quick single test, green.
  makeExecution({
    id: "r-0143",
    names: ["test_wan_ipv4_after_reboot"],
    boardModel: "TG2492LG",
    bed: "TG2492LG-1-2",
    env: "env-ch7465-ipv4-minimal",
    ageMin: 11,
    durationMin: 12,
    triggeredBy: "j.okafor",
    status: "completed",
  }),
  // Voice codec quick run that FAILED — populates the Analysis tab.
  makeExecution({
    id: "r-0145",
    names: ["test_voice_rtp_codec_g711a"],
    boardModel: "TG2492LG",
    bed: "TG2492LG-1-1",
    env: "env-ch7465-upc-dual-voice",
    ageMin: 9 * 60,
    durationMin: 22,
    triggeredBy: "s.byrne",
    status: "failed",
    error: {
      step: "execute",
      message:
        "SIP registration never completed on softphone1: pjsip got no 200 OK for its REGISTER within the 30s window. The MTA boot file provisioned line 1 with a number the SIP center doesn't know about.",
    },
  }),
  // Ticket → tested, paused at the human review gate (waiting on you).
  makeRun({
    id: "r-0141",
    workflow: "ticket-to-tested",
    status: "awaiting_approval",
    ageMin: 12,
    triggeredBy: "you",
    steps: {
      "fetch-ticket": { state: "completed", summary: "BF-1234 pulled · 3 steps" },
      generate: {
        state: "completed",
        summary: "1 file generated",
        artifact_ids: ["a-090"],
      },
      review: { state: "awaiting_approval" },
    },
  }),
  // Nightly running right now — reserve done, Jenkins build in progress.
  makeRun({
    id: "r-0140",
    workflow: "nightly-sanity",
    status: "running",
    ageMin: 4,
    triggeredBy: "scheduler",
    steps: {
      reserve: {
        state: "completed",
        summary: "docsis-31-b2 reserved",
        details: { bed: "docsis-31-b2", board: "DEMO_X1", reservation: "resv-8841" },
      },
      execute: { state: "running" },
    },
  }),
  // Nightly that failed mid-run because the bed went offline.
  makeRun({
    id: "r-0139",
    workflow: "nightly-sanity",
    status: "failed",
    ageMin: 8 * 60,
    durationMin: 6,
    triggeredBy: "scheduler",
    steps: {
      reserve: {
        state: "completed",
        summary: "docsis-31-b4 reserved",
        details: { bed: "docsis-31-b4", board: "DEMO_X1", reservation: "resv-8834" },
      },
      execute: {
        state: "failed",
        details: { build: "#4201", bed: "docsis-31-b4", board: "DEMO_X1", image: "6.2.1-release" },
      },
    },
    error: {
      step: "execute",
      message:
        "Jenkins build #4201 aborted: bed docsis-31-b4 lost console during ranging (T3 timeout). The bed may be offline — retry on another bed.",
    },
  }),
  // Plan → generate → tested, paused at plan review.
  makeRun({
    id: "r-0138",
    workflow: "plan-generate-tested",
    status: "awaiting_approval",
    ageMin: 40,
    triggeredBy: "you",
    steps: {
      plan: {
        state: "completed",
        summary: "12 tests planned",
        artifact_ids: ["a-092"],
      },
      "review-plan": { state: "awaiting_approval" },
    },
  }),
  // Ticket → tested, completed end-to-end (Jenkins passed).
  makeRun({
    id: "r-0137",
    workflow: "ticket-to-tested",
    status: "completed",
    ageMin: 26 * 60,
    durationMin: 9,
    triggeredBy: "skhan",
    steps: {
      "fetch-ticket": { state: "completed", summary: "BF-1180 pulled · 4 steps" },
      generate: { state: "completed", summary: "1 file generated", artifact_ids: ["a-093"] },
      review: { state: "completed", summary: "changes approved" },
      "open-pr": { state: "completed", summary: "MR !402 opened", details: { merge_request: "!402", branch: "ai/BF-1180", target: "main" } },
      execute: { state: "completed", summary: "1 passed", details: { ...JENKINS_PASS, result: "1 passed" } },
      analyze: { state: "completed", summary: "no failures" },
    },
  }),
  // Nightly completed with findings (analysis artifact attached).
  makeRun({
    id: "r-0136",
    workflow: "nightly-sanity",
    status: "completed",
    ageMin: 20 * 60,
    durationMin: 22,
    triggeredBy: "scheduler",
    steps: {
      reserve: { state: "completed", summary: "docsis-31-b2 reserved" },
      execute: { state: "completed", summary: "23 passed · 2 failed", details: { build: "#4188", bed: "docsis-31-b2", board: "DEMO_X1", image: "6.2.0-release", result: "23 passed · 2 failed" } },
      analyze: { state: "completed", summary: "2 findings", artifact_ids: ["a-094"] },
      report: { state: "completed", summary: "report posted to BF-NIGHTLY" },
    },
  }),
  // Plan → generate → tested, cancelled after the plan.
  makeRun({
    id: "r-0135",
    workflow: "plan-generate-tested",
    status: "cancelled",
    ageMin: 30 * 60,
    durationMin: 2,
    triggeredBy: "mkumar",
    steps: {
      plan: { state: "completed", summary: "5 tests planned" },
      "review-plan": { state: "skipped" },
    },
  }),
  // Ticket → tested, completed.
  makeRun({
    id: "r-0134",
    workflow: "ticket-to-tested",
    status: "completed",
    ageMin: 49 * 60,
    durationMin: 11,
    triggeredBy: "you",
    steps: {
      "fetch-ticket": { state: "completed", summary: "BF-1150 pulled · 5 steps" },
      generate: { state: "completed", summary: "1 file generated" },
      review: { state: "completed", summary: "changes approved" },
      "open-pr": { state: "completed", summary: "MR !399 opened" },
      execute: { state: "completed", summary: "1 passed", details: { ...JENKINS_PASS, build: "#4176", result: "1 passed" } },
      analyze: { state: "completed", summary: "no failures" },
    },
  }),
  // Plan → generate → tested, failed at Jenkins execution.
  makeRun({
    id: "r-0133",
    workflow: "plan-generate-tested",
    status: "failed",
    ageMin: 52 * 60,
    durationMin: 14,
    triggeredBy: "skhan",
    steps: {
      plan: { state: "completed", summary: "6 tests planned" },
      "review-plan": { state: "completed", summary: "plan approved" },
      generate: { state: "completed", summary: "6 files generated" },
      "open-pr": { state: "completed", summary: "MR !388 opened" },
      execute: { state: "failed", details: { build: "#4160", bed: "docsis-31-b1", board: "DEMO_X1", image: "6.2.0-release" } },
    },
    error: {
      step: "execute",
      message:
        "Jenkins build #4160 failed: 4 of 6 tests errored in setup — erouter did not reach OPERATIONAL within 300s. Check provisioning on bed docsis-31-b1.",
    },
  }),
  // Nightly completed clean.
  makeRun({
    id: "r-0132",
    workflow: "nightly-sanity",
    status: "completed",
    ageMin: 70 * 60,
    durationMin: 19,
    triggeredBy: "scheduler",
    steps: {
      reserve: { state: "completed", summary: "docsis-31-b3 reserved" },
      execute: { state: "completed", summary: "25 passed", details: { build: "#4142", bed: "docsis-31-b3", board: "DEMO_X1", image: "6.2.0-release", result: "25 passed" } },
      analyze: { state: "completed", summary: "no findings" },
      report: { state: "completed", summary: "report posted to BF-NIGHTLY" },
    },
  }),
  // Ticket → tested, completed.
  makeRun({
    id: "r-0131",
    workflow: "ticket-to-tested",
    status: "completed",
    ageMin: 96 * 60,
    durationMin: 10,
    triggeredBy: "you",
    steps: {
      "fetch-ticket": { state: "completed", summary: "BF-1090 pulled · 3 steps" },
      generate: { state: "completed", summary: "1 file generated" },
      review: { state: "completed", summary: "changes approved" },
      "open-pr": { state: "completed", summary: "MR !370 opened" },
      execute: { state: "completed", summary: "1 passed", details: { ...JENKINS_PASS, build: "#4120", result: "1 passed" } },
      analyze: { state: "completed", summary: "no failures" },
    },
  }),
];

/** The engine id counter continues after the newest seeded run. */
export const RUN_COUNTER_START = 146;
