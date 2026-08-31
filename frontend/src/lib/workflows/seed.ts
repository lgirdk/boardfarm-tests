import type { WorkflowDef } from "@/lib/contracts";

/**
 * Seeded workflow catalog — the mock IS the contract the backend will serve
 * from GET /api/workflows. A workflow chains our AI **apps** (kind:"app"),
 * external **integrations** (kind:"integration" — git / jenkins / jira) and
 * human **gates** (kind:"gate", gateway:true). Execution happens in Jenkins;
 * these workflows just orchestrate it.
 *
 * `MOCK_BEHAVIOR` is mock-engine metadata only (never part of the contract):
 * per-step durations/summaries, produced artifacts, execution details, and a
 * deliberate mid-step failure so the failure UI is real.
 */
export const WORKFLOWS_SEED: WorkflowDef[] = [
  {
    name: "ticket-to-tested",
    title: "Ticket → tested",
    description:
      "From a Jira ticket to a reviewed test running on a bed: generate code, gate on review, open a PR, run it in Jenkins, and analyze any failures.",
    steps: [
      { name: "fetch-ticket", title: "Pull ticket", label: "jira" },
      { name: "generate", title: "Generate code", label: "codegen" },
      { name: "review", title: "Review code", approval: true },
      { name: "open-pr", title: "Open pull request", label: "git", summary: "opens merge request" },
      { name: "execute", title: "Run on bed", label: "jenkins" },
      { name: "analyze", title: "Analyze result", label: "analyzer" },
    ],
    input_descriptor: [
      {
        kind: "string",
        key: "ticket",
        label: "Jira ticket",
        required: true,
        placeholder: "BF-1234",
        description: "The ticket whose steps become the test.",
      },
      {
        kind: "string",
        key: "board",
        label: "Board",
        required: true,
        placeholder: "docsis-31-b2",
        description: "Which bed/board to run on.",
      },
    ],
  },
  {
    name: "plan-generate-tested",
    title: "Plan → generate → tested",
    description:
      "Turn a feature or epic into a set of planned tests, review the plan, generate the code, open a PR and run it in Jenkins.",
    steps: [
      { name: "plan", title: "Plan tests", label: "planner" },
      { name: "review-plan", title: "Review plan", approval: true },
      { name: "generate", title: "Generate code", label: "codegen" },
      { name: "open-pr", title: "Open pull request", label: "git", summary: "opens merge request" },
      { name: "execute", title: "Run on bed", label: "jenkins" },
    ],
    input_descriptor: [
      {
        kind: "string",
        key: "title",
        label: "Title",
        required: true,
        placeholder: "wan ipv4 regression pack",
      },
      {
        kind: "string",
        key: "scenario",
        label: "Scenario or epic",
        required: true,
        multiline: true,
        description: "Free-text scope, or a Jira epic key.",
      },
    ],
  },
  {
    name: "nightly-sanity",
    title: "Nightly sanity",
    description:
      "Scheduled run of an existing suite on a bed pool, with automatic failure analysis and a published report. No gates — runs unattended.",
    steps: [
      { name: "reserve", title: "Reserve bed", label: "jenkins" },
      { name: "execute", title: "Run sanity suite", label: "jenkins" },
      { name: "analyze", title: "Analyze failures", label: "analyzer" },
      { name: "report", title: "Publish report", label: "jira" },
    ],
    input_descriptor: [
      {
        kind: "string",
        key: "suite",
        label: "Suite",
        required: true,
        placeholder: "sanity-docsis31",
      },
      {
        kind: "string",
        key: "bed_pool",
        label: "Bed pool",
        required: true,
        placeholder: "docsis31-pool",
      },
    ],
  },
  {
    name: "test-run",
    title: "Test run",
    description:
      "Run selected tests on a board: reserve a bed, flash firmware, provision the environment, execute, and release. Started from the Library/Runs, not a pipeline card.",
    steps: [
      { name: "reserve", title: "Reserve bed", label: "boardfarm" },
      { name: "flash", title: "Flash firmware", label: "boardfarm" },
      { name: "provision", title: "Provision environment", label: "boardfarm" },
      { name: "execute", title: "Execute tests", label: "pytest" },
      { name: "cleanup", title: "Release bed", label: "boardfarm" },
    ],
    input_descriptor: [
      {
        kind: "string",
        key: "board_model",
        label: "Board type",
        required: true,
        placeholder: "CH7465LG",
      },
      {
        kind: "string",
        key: "env_name",
        label: "Environment",
        required: true,
        placeholder: "CH7465LG · UPC dual",
      },
    ],
  },
];

export interface StepArtifactSpec {
  name: string;
  type: string;
  language?: string;
  content: string;
}

export interface StepBehavior {
  /** Simulated step duration (ms). */
  duration: number;
  /** Completion summary line shown under the step in the rail. */
  summary: string;
  /** Draft artifact(s) this step produces when it completes (mock only). */
  artifacts?: StepArtifactSpec[];
  /** Structured detail for integration steps (Jenkins build/bed/image). */
  details?: Record<string, string>;
}

export interface WorkflowBehavior {
  steps: Record<string, StepBehavior>;
  /** Step name at which a mock run of this workflow fails (if any). */
  failAtStep?: string;
  failMessage?: string;
}

const GENERATED_TEST = `import pytest


@pytest.mark.env_req({"board": {"eRouter_Provisioning_mode": "dual"}})
def test_wan_ipv4_after_reboot(board, wan):
    """Verify WAN keeps IPv4 lease across reboot."""
    reboot_device(board)
    wait_for_docsis_online(board, timeout=300)
    assert wan.get_eth_interface_ipv4_address()
`;

const PLAN_DOC = `# Test plan

| name | tags | env_req | steps |
|---|---|---|---|
| test_wan_ipv4_after_reboot | wan, reboot | dual | 3 |
| test_lan_dhcp_renew | lan, dhcp | dual | 4 |
| test_cm_status_online | docsis | any | 2 |
`;

const JENKINS_DETAILS = {
  build: "#4213",
  bed: "docsis-31-b2",
  board: "DEMO_X1",
  image: "6.2.1-release",
  result: "23 passed · 2 failed",
};

/** Mock-engine behavior per workflow. NOT part of the API contract. */
export const MOCK_BEHAVIOR: Record<string, WorkflowBehavior> = {
  "ticket-to-tested": {
    steps: {
      "fetch-ticket": { duration: 1500, summary: "BF-1234 pulled · 3 steps" },
      generate: {
        duration: 4500,
        summary: "1 file generated",
        artifacts: [
          {
            name: "test_wan_ipv4_after_reboot.py",
            type: "test_code",
            language: "python",
            content: GENERATED_TEST,
          },
        ],
      },
      review: { duration: 2000, summary: "changes approved" },
      "open-pr": {
        duration: 2000,
        summary: "MR !412 opened",
        details: { branch: "ai/BF-1234", merge_request: "!412", target: "main" },
      },
      execute: {
        duration: 5000,
        summary: "1 passed",
        details: {
          build: "#4213",
          bed: "docsis-31-b2",
          board: "DEMO_X1",
          image: "6.2.1-release",
          result: "1 passed",
        },
      },
      analyze: { duration: 2000, summary: "no failures" },
    },
  },
  "plan-generate-tested": {
    steps: {
      plan: {
        duration: 3000,
        summary: "12 tests planned",
        artifacts: [
          { name: "plan.md", type: "plan", language: "markdown", content: PLAN_DOC },
        ],
      },
      "review-plan": { duration: 1500, summary: "plan approved" },
      generate: {
        duration: 4500,
        summary: "12 files generated",
        artifacts: [
          {
            name: "test_wan_ipv4_after_reboot.py",
            type: "test_code",
            language: "python",
            content: GENERATED_TEST,
          },
        ],
      },
      "open-pr": {
        duration: 2000,
        summary: "MR !413 opened",
        details: { branch: "ai/wan-pack", merge_request: "!413", target: "main" },
      },
      execute: {
        duration: 5000,
        summary: "12 passed",
        details: { ...JENKINS_DETAILS, result: "12 passed" },
      },
    },
  },
  "nightly-sanity": {
    steps: {
      reserve: {
        duration: 1500,
        summary: "docsis-31-b2 reserved",
        details: { bed: "docsis-31-b2", board: "DEMO_X1", reservation: "resv-8841" },
      },
      execute: {
        duration: 5000,
        summary: "23 passed · 2 failed",
        details: JENKINS_DETAILS,
      },
      analyze: { duration: 3000, summary: "2 findings" },
      report: { duration: 1500, summary: "report posted to BF-NIGHTLY" },
    },
    // A realistic mid-run failure: the bed goes offline during execution.
    failAtStep: "execute",
    failMessage:
      "Jenkins build #4213 aborted: bed docsis-31-b2 lost console during ranging (T3 timeout). The bed may be offline — check the reservation or retry on another bed.",
  },
  "test-run": {
    steps: {
      reserve: {
        duration: 2200,
        summary: "bed reserved",
        details: { bed: "CH7465LG-3-1", board: "CH7465LG", reservation: "resv-9002" },
      },
      flash: {
        duration: 4200,
        summary: "image flashed",
        details: { image: "ofw-mv1cbn-r23-oe40", strategy: "all" },
      },
      provision: {
        duration: 3600,
        summary: "eRouter online",
        details: { prov_mode: "dual", cmts: "CC8800" },
      },
      execute: {
        duration: 5200,
        summary: "1 passed",
        details: { runner: "pytest-boardfarm3", result: "1 passed" },
      },
      cleanup: { duration: 1600, summary: "bed released" },
    },
  },
};
