import type {
  AnalysisReport,
  AnalyzeLogsInput,
  CodegenGenerateInput,
  JobRef,
  PlanTestsInput,
  TestPlan,
  WorkflowDef,
} from "@/lib/contracts";
import type {
  JiraIssueType,
  JiraProject,
  JiraSearchQuery,
  JiraSearchResult,
  JiraTicket,
  JiraUser,
} from "@/lib/contracts";
import type { AppsClient } from "./AppsClient";
import type { RunEngine } from "@/lib/runs/engine";
import type { WorkflowBehavior } from "@/lib/workflows/seed";
import { REGISTRIES_SEED } from "@/lib/registries";

/**
 * Mock app invocations. Each one triggers a pseudo-workflow on the SHARED run
 * engine, so app jobs appear in Runs alongside pipeline runs and live-update
 * through the same subscribe seam. Outputs are attached to the run when the
 * final step completes.
 *
 * The codegen pseudo-workflow's steps come from the registries seed
 * (reasoning/search/generation) — the same stage list the real engine runs.
 */

const CODEGEN_DEF: WorkflowDef = {
  name: "app:codegen",
  title: "Codegen",
  description: "Single codegen invocation",
  steps: REGISTRIES_SEED.codegen_stages.map((s) => ({
    name: s,
    title: s,
    label: "codegen",
  })),
  input_descriptor: [],
};

const CODEGEN_BEHAVIOR: WorkflowBehavior = {
  steps: Object.fromEntries(
    REGISTRIES_SEED.codegen_stages.map((s, i) => [
      s,
      { duration: 1800 + i * 600, summary: `${s} complete` },
    ]),
  ),
};

const PLANNER_DEF: WorkflowDef = {
  name: "app:planner",
  title: "Test planner",
  description: "Single planning invocation",
  steps: [
    { name: "analyze-input", title: "Analyze input", label: "planner" },
    { name: "draft-plan", title: "Draft plan", label: "planner" },
  ],
  input_descriptor: [],
};

const PLANNER_BEHAVIOR: WorkflowBehavior = {
  steps: {
    "analyze-input": { duration: 1500, summary: "scope identified" },
    "draft-plan": { duration: 2500, summary: "plan drafted" },
  },
};

const ANALYZER_DEF: WorkflowDef = {
  name: "app:analyzer",
  title: "Log analyzer",
  description: "Single analysis invocation",
  steps: [
    { name: "parse-logs", title: "Parse logs", label: "analyzer" },
    { name: "analyze", title: "Analyze", label: "analyzer" },
  ],
  input_descriptor: [],
};

const ANALYZER_BEHAVIOR: WorkflowBehavior = {
  steps: {
    "parse-logs": { duration: 1500, summary: "log stream parsed" },
    analyze: { duration: 3000, summary: "findings ready" },
  },
};

export class MockAppsClient implements AppsClient {
  constructor(private readonly engine: RunEngine) {}

  async generateCode(input: CodegenGenerateInput): Promise<JobRef> {
    const run = this.engine.trigger({
      workflow: CODEGEN_DEF,
      input: { name: input.name, steps: input.steps.length },
      behavior: CODEGEN_BEHAVIOR,
      makeOutput: () => ({ generated_code: mockGeneratedCode(input) }),
    });
    return { run_id: run.id };
  }

  async planTests(input: PlanTestsInput): Promise<JobRef> {
    const run = this.engine.trigger({
      workflow: PLANNER_DEF,
      input: { title: input.title, source: input.source },
      behavior: PLANNER_BEHAVIOR,
      makeOutput: () => ({ plan: mockPlan(input) }),
    });
    return { run_id: run.id };
  }

  async analyzeLogs(input: AnalyzeLogsInput): Promise<JobRef> {
    const run = this.engine.trigger({
      workflow: ANALYZER_DEF,
      input: {
        source: input.artifact_id ? `artifact:${input.artifact_id}` : "pasted",
      },
      behavior: ANALYZER_BEHAVIOR,
      makeOutput: () => ({ report: mockReport() }),
    });
    return { run_id: run.id };
  }

  async jiraMe(): Promise<JiraUser> {
    await delay(300);
    return { display_name: "user-xyz", email: "user-xyz@example.com" };
  }

  async jiraProjects(): Promise<JiraProject[]> {
    await delay(400);
    return [
      { key: "MVX_Tests", name: "MVX Tests" },
      { key: "BF", name: "Boardfarm" },
      { key: "DOCSIS", name: "DOCSIS Automation" },
      { key: "LGI", name: "LGI Shared" },
    ];
  }

  async jiraTypes(projectKey: string): Promise<JiraIssueType[]> {
    await delay(300);
    void projectKey;
    return [
      { id: "1", name: "Epic" },
      { id: "2", name: "Story" },
      { id: "3", name: "Bug" },
      { id: "4", name: "Task" },
      { id: "5", name: "XTest Execution" },
      { id: "6", name: "XTest Set" },
      { id: "7", name: "XTest" },
      { id: "8", name: "Test" },
      { id: "9", name: "XSub Test Execution" },
      { id: "10", name: "XTest Plan" },
      { id: "11", name: "XPre-Condition" },
      { id: "12", name: "Automation Task" },
    ];
  }

  async jiraSearch(query: JiraSearchQuery): Promise<JiraSearchResult[]> {
    await delay(600);
    const text = (query.text ?? query.jql ?? "").toLowerCase();
    return MOCK_SEARCH_RESULTS.filter(
      (r) =>
        (!query.project || r.key.startsWith(query.project.replace("_", "-"))) &&
        (!query.issue_type || query.issue_type === "All" || r.issue_type === query.issue_type) &&
        (!text || r.summary.toLowerCase().includes(text) || r.key.toLowerCase().includes(text)),
    );
  }

  async fetchJiraTicket(key: string): Promise<JiraTicket> {
    await delay(700);
    const k = key.trim().toUpperCase();
    if (!k) throw new Error("Enter a ticket id, e.g. BF-1234.");
    const found = MOCK_SEARCH_RESULTS.find((r) => r.key === k);
    return {
      key: k,
      summary: found?.summary ?? "Verify WAN IPv4 connectivity survives CM reboot",
      description:
        "Regression seen on docsis-3.1 beds: after a software-initiated reboot the erouter sometimes comes up without an IPv4 lease.",
      preconditions: "Board provisioned in dual-stack mode; CM online.",
      steps: [
        {
          instruction: "Reboot the CPE via software command",
          expected_result: "Device goes down and boots within 300s",
        },
        {
          instruction: "Wait for DOCSIS to come online",
          expected_result: "CM status reaches OPERATIONAL",
        },
        {
          instruction: "Check the erouter WAN interface addressing",
          expected_result: "IPv4 lease present on the WAN interface",
        },
      ],
    };
  }
}

/* ── helpers & mock data ────────────────────────────────────────────── */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOCK_SEARCH_RESULTS: JiraSearchResult[] = [
  { key: "MVX-TST-1985", summary: "Verify LLC filter blocks non-IP traffic on CPE", issue_type: "XTest", status: "Open", updated: "2026-08-20" },
  { key: "MVX-TST-10022", summary: "TR-069 AddObject creates DHCPv4 subnet entry", issue_type: "XTest", status: "Open", updated: "2026-08-18" },
  { key: "MVX-TST-152070", summary: "Voice call survives firmware upgrade", issue_type: "XTest", status: "In Progress", updated: "2026-08-15" },
  { key: "MVX-TST-80975", summary: "UPnP port forwarding via WiFi client", issue_type: "XTest", status: "Open", updated: "2026-08-12" },
  { key: "MVX-TST-148603", summary: "Firmware update failure — file not found on server", issue_type: "XTest", status: "Open", updated: "2026-08-10" },
  { key: "MVX-TST-171544", summary: "GUI WiFi 5G SSID change persists after reboot", issue_type: "XTest", status: "Done", updated: "2026-08-08" },
  { key: "MVX-TST-112780", summary: "Reverse SSH tunnel active after TR-069 enable", issue_type: "XTest", status: "Open", updated: "2026-08-05" },
  { key: "MVX-TST-142209", summary: "SSAM blocks malicious site when agent is enabled", issue_type: "XTest", status: "Open", updated: "2026-07-30" },
  { key: "MVX-TST-153099", summary: "24-hour stability — no reboot loops", issue_type: "XTest", status: "In Progress", updated: "2026-07-25" },
  { key: "MVX-TST-175039", summary: "Samknows agent version matches provisioned value", issue_type: "XTest", status: "Open", updated: "2026-07-20" },
  { key: "BF-1234", summary: "Verify WAN IPv4 connectivity survives CM reboot", issue_type: "Test", status: "Open", updated: "2026-08-22" },
  { key: "BF-1180", summary: "DHCPv6 lease renewal after factory reset", issue_type: "Test", status: "Open", updated: "2026-08-19" },
];

/* ── canned result builders (mock only) ─────────────────────────────── */

function mockGeneratedCode(input: CodegenGenerateInput): string {
  const funcName =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "generated";
  const stepComments = input.steps
    .map((s) => `    # Step ${s.step_num}: ${s.instruction}`)
    .join("\n");
  return `import pytest


def test_${funcName}(board, wan):
    """${input.description ?? "Generated test"}"""
${input.preconditions ? `    # Preconditions: ${input.preconditions}\n` : ""}${stepComments || "    # (no steps provided)"}
    wait_for_docsis_online(board, timeout=300)
    assert wan.get_eth_interface_ipv4_address()
`;
}

function mockPlan(input: PlanTestsInput): TestPlan {
  return {
    title: input.title,
    source: input.source === "jira-epic" ? `jira:${input.epic_key ?? ""}` : "free-text",
    tests: [
      {
        name: "test_wan_ipv4_after_reboot",
        preconditions: "CM online, dual-stack provisioning",
        tags: ["wan", "reboot"],
        steps: [
          "Reboot the CPE via software command",
          "Wait for DOCSIS to come online",
          "Assert IPv4 lease present on the WAN interface",
        ],
      },
      {
        name: "test_lan_dhcp_renew",
        preconditions: "LAN client connected",
        tags: ["lan", "dhcp"],
        steps: [
          "Record the current DHCP lease",
          "Force a DHCP renew from the LAN client",
          "Assert the client keeps a valid lease",
        ],
      },
      {
        name: "test_cm_status_online",
        tags: ["docsis"],
        steps: [
          "Provision the cable modem",
          "Assert CM status reaches OPERATIONAL",
        ],
      },
    ],
  };
}

function mockReport(): AnalysisReport {
  return {
    summary:
      "2 findings. The boot sequence stalls during upstream ranging; downstream lock looks healthy.",
    findings: [
      {
        severity: "critical",
        message: "T3 ranging timeout on upstream channel 3 (4 retries)",
        suspected_cause:
          "Upstream attenuation drift on the testbed RF path — check pad configuration on bed 2.",
      },
      {
        severity: "minor",
        message: "TR-069 inform retries before ACS session established",
        suspected_cause:
          "ACS reachable only after WAN DNS came up; expected during early boot.",
      },
    ],
  };
}
