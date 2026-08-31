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

const JENKINS_PASS = {
  build: "#4207",
  bed: "docsis-31-b2",
  board: "DEMO_X1",
  image: "6.2.1-release",
  result: "12 passed",
};

export const HISTORICAL_RUNS: Run[] = [
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
export const RUN_COUNTER_START = 142;
