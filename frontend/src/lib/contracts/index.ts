import type { FieldDescriptor } from "@/lib/schema/types";

/**
 * Shared platform contracts — the single place where frontend types mirror the
 * future backend `src/contracts/`. The mock clients implement exactly these
 * shapes; the backend must too. Do not add UI-only fields here.
 */

/* ── identity ─────────────────────────────────────────────────────────── */

export interface Workspace {
  id: string;
  name: string;
}

export interface User {
  username: string;
  display_name: string;
  /** Two-letter monogram for the avatar chip. */
  initials: string;
  workspace: Workspace;
}

/* ── workflows ────────────────────────────────────────────────────────── */

export interface WorkflowStepDef {
  /** Machine name (mono in the UI), e.g. "generate". */
  name: string;
  /** Human title for tooltips/cards. */
  title: string;
  /** True = the run pauses here in `awaiting_approval` until a human approves. */
  approval?: boolean;
  /**
   * Optional free-text display hint the backend MAY send (e.g. "jenkins",
   * "git"). Pure decoration — the frontend just prints it; it never infers it.
   */
  label?: string;
  /** Short hint shown under pending steps (e.g. "opens merge request"). */
  summary?: string;
}

export interface WorkflowDef {
  name: string;
  title: string;
  description: string;
  steps: WorkflowStepDef[];
  /** Rendered with the existing FieldRenderer engine — no second form system. */
  input_descriptor: FieldDescriptor[];
}

/* ── runs ─────────────────────────────────────────────────────────────── */

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type StepState =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "skipped";

export interface RunStep {
  name: string;
  title: string;
  approval?: boolean;
  label?: string;
  state: StepState;
  /** One-line outcome, e.g. "12 tests planned". */
  summary?: string;
  started_at?: number;
  finished_at?: number;
  artifact_ids?: string[];
  /** Backend-provided structured detail (e.g. a Jenkins build's bed/image). */
  details?: Record<string, string>;
}

export interface RunError {
  step: string;
  message: string;
}

export interface Run {
  /** Short mono id, e.g. "r-0142". */
  id: string;
  workflow: string;
  workflow_title: string;
  status: RunStatus;
  triggered_by: string;
  workspace: string;
  created_at: number;
  started_at?: number;
  finished_at?: number;
  steps: RunStep[];
  /** Name of the step currently running / awaiting. */
  current_step?: string;
  error?: RunError;
  input?: Record<string, unknown>;
  /** Extra user-requested pause points (step names) beyond gateway steps. */
  pause_after?: string[];
  /** Terminal output payload for app-style runs (e.g. generated code). */
  output?: Record<string, unknown>;
}

export interface RunEvent {
  run_id: string;
  ts: number;
  type: "status" | "step" | "artifact" | "error";
  message: string;
  step?: string;
  /** Full run snapshot at event time — subscribers render from this. */
  run: Run;
}

export interface RunFilter {
  status?: RunStatus[];
  workflow?: string;
}

/* ── available tests (git-backed catalog) ────────────────────────────── */

/**
 * A real, runnable test that lives in the git repo. The backend reads git and
 * serves this structured view; the frontend never stores it. This is what you
 * browse to pick tests to run or schedule — distinct from Drafts (AI outputs).
 */
export interface TestAsset {
  /** Stable id (e.g. the repo path). */
  id: string;
  /** Test function name (mono in the UI). */
  name: string;
  /** Path within the repo. */
  path: string;
  /** Suite/area from the repo structure: gui, voice, docsis, wifi, networking… */
  suite: string;
  tags: string[];
  /** Summary of the test's @pytest.mark.env_req marker, if any. */
  env_req?: string;
  /** Provisioning modes the test accepts (OR): ["dual"] or ["dual","ipv4"]. */
  env_modes: string[];
  /** Minimum LAN clients required. */
  lan_clients: number;
  /** Extra capabilities: voice, tr069, wifi5, wifi24, gui, flash, reset. */
  capabilities: string[];
  /** Human runtime estimate, e.g. "12m". */
  runtime: string;
  /** One-line description (docstring). */
  description?: string;
  /** Step strings as emitted by bf_logger.log_step(). */
  steps?: string[];
  /** Recorded last-N outcomes (1 pass, 0 fail), newest last. */
  health?: number[];
  /** Where it comes from — today always the git repo. */
  source: "git";
  updated_at: number;
}

export interface TestFilter {
  suite?: string;
  tag?: string;
}

/**
 * Resolved requirement across a set of tests (see lib/requirement.ts). Modes are
 * the intersection (OR within a test, AND across tests); lanClients is the max;
 * capabilities are the union. `conflict` = the mode intersection is empty.
 */
export interface Requirement {
  modes: string[];
  lanClients: number;
  capabilities: string[];
  conflict: boolean;
}

/* ── beds (physical device beds — display only) ──────────────────────── */

export type BedStatus = "free" | "in_use" | "offline" | "maintenance";

/**
 * A physical device bed from the lab inventory (ams.json). Users never edit
 * these; they see availability and pick a board TYPE — boardfarm reserves an
 * actual free bed from the matching pool.
 */
export interface Bed {
  /** Inventory key, e.g. "CH7465LG-3-1". */
  id: string;
  board_model: string;
  location: string;
  status: BedStatus;
  /** Username holding the bed when in_use. */
  held_by?: string;
  /** Run currently using the bed. */
  held_run_id?: string;
  /** Capabilities the bed supports: voice, wifi, docsis3.1… */
  features: string[];
  /** Device roles present on the bed: board, wan, lan, sipcenter, tftp… */
  devices: string[];
  labels?: string[];
}

/** Availability rollup for one board model (derived from beds). */
export interface BoardTypeAvailability {
  board_model: string;
  total: number;
  free: number;
  in_use: number;
  offline: number;
  features: string[];
}

/* ── environments (reusable provisioning descriptors) ────────────────── */

export type EnvProvMode = "ipv4" | "ipv6" | "dual" | "dslite" | "disabled";
export type EnvVisibility = "private" | "published";

/**
 * A reusable environment descriptor (environment_def JSON). Selected during a
 * run or browsed/managed in the Environments catalog. "private" = the author's
 * custom env; "published" = shared with the team.
 */
export interface EnvConfig {
  id: string;
  name: string;
  board_model: string;
  sku: string;
  prov_mode: EnvProvMode;
  wifi: boolean;
  voice: boolean;
  /** LAN clients this env provisions. */
  lan: number;
  /** Provides a TR-069 / ACS block. */
  tr069: boolean;
  /** WiFi client bands this env provisions, e.g. ["5"] or ["5","2.4"]. */
  wifi_bands: string[];
  /** Firmware image this env flashes, if any. */
  firmware?: string | null;
  /** Whether the env factory-resets before the run. */
  reset?: boolean;
  visibility: EnvVisibility;
  owner: string;
  updated_at: number;
  /** Short tags used to match a test's env_req (e.g. "dual", "wifi", "voice"). */
  env_tags: string[];
  /** The raw environment_def JSON, pretty-printed. */
  content: string;
}

export interface EnvFilter {
  board_model?: string;
  visibility?: EnvVisibility;
}

/* ── test suites (named collections of tests) ────────────────────────── */

/**
 * A named, saved collection of tests the user assembles in the Library and
 * runs as one execution. "private" until the author shares it with the team.
 */
export interface TestSuite {
  id: string;
  name: string;
  /** TestAsset ids in this suite. */
  test_ids: string[];
  owner: string;
  visibility: EnvVisibility;
  updated_at: number;
}

/* ── schedules (a saved RunSpec with a clock) ────────────────────────── */

export interface Schedule {
  id: string;
  name: string;
  /** What it runs, e.g. "12 tests · docsis + networking". */
  what: string;
  /** Raw cron and its human form. */
  cron: string;
  human: string;
  /** Board rule, e.g. "CH7465LG (any free bed)". */
  board: string;
  env: string;
  enabled: boolean;
  last: string;
  last_state: RunStatus;
  next: string;
}

/* ── artifacts ────────────────────────────────────────────────────────── */

export type ArtifactStatus = "draft" | "published";

export interface Artifact {
  id: string;
  /** File-ish display name (mono), e.g. "test_wan_ipv4_after_reboot.py". */
  name: string;
  /** Free-form kind from the producing app, e.g. "test_code", "plan". */
  type: string;
  workspace: string;
  status: ArtifactStatus;
  created_at: number;
  version: number;
  content: string;
  /** Rendering hint: "python" | "markdown" | "text". */
  language?: string;
  run_id?: string;
  step?: string;
  /** For AI-generated test drafts: origin, requirement and recorded history. */
  source_ref?: string;
  env_modes?: string[];
  lan_clients?: number;
  capabilities?: string[];
  run_count?: number;
  last_result?: "passed" | "failed" | null;
}

export interface ArtifactFilter {
  status?: ArtifactStatus;
  type?: string;
  run_id?: string;
}

export interface PublishResult {
  ok: boolean;
  /** Merge-request URL for published code artifacts. */
  url?: string;
}

/* ── app invocation inputs ───────────────────────────────────────────── */

/** Mirrors the backend's TestStep (src/codegen/data_models.py). */
export interface CodegenStepInput {
  step_num: number;
  instruction: string;
  additional_info?: string | null;
  expected_result?: string | null;
}

/** Mirrors the backend's CodegenTestInput. */
export interface CodegenGenerateInput {
  name: string;
  description?: string | null;
  preconditions?: string | null;
  steps: CodegenStepInput[];
}

export interface PlanTestsInput {
  title: string;
  /** "free-text" or "jira-epic". */
  source: string;
  scenario?: string;
  epic_key?: string;
}

export interface AnalyzeLogsInput {
  /** Exactly one of these should be set. */
  logs?: string;
  artifact_id?: string;
}

/** App invocations return a run id; results arrive via RunsClient.subscribe. */
export interface JobRef {
  run_id: string;
}

/* ── planner / analyzer payloads ─────────────────────────────────────── */

export interface PlannedTest {
  name: string;
  preconditions?: string;
  tags: string[];
  steps: string[];
}

export interface TestPlan {
  title: string;
  /** Where the plan came from, e.g. "jira:EPIC-42" or "free-text". */
  source: string;
  tests: PlannedTest[];
}

export type FindingSeverity = "critical" | "major" | "minor";

export interface AnalysisFinding {
  severity: FindingSeverity;
  message: string;
  suspected_cause: string;
}

export interface AnalysisReport {
  summary: string;
  findings: AnalysisFinding[];
}

/* ── jira ─────────────────────────────────────────────────────────────── */

export interface JiraUser {
  display_name: string;
  email?: string;
}

export interface JiraProject {
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
}

export interface JiraSearchResult {
  key: string;
  summary: string;
  issue_type: string;
  status: string;
  updated: string;
}

export interface JiraSearchQuery {
  project?: string;
  issue_type?: string;
  text?: string;
  jql?: string;
}

export interface JiraTicketStep {
  instruction: string;
  expected_result?: string;
}

/** A pulled Jira ticket, pre-shaped for the codegen input preview. */
export interface JiraTicket {
  key: string;
  summary: string;
  description?: string;
  preconditions?: string;
  steps: JiraTicketStep[];
}

/* ── jira test-plan resolution (Suites → Import a Jira test plan) ────────── */
export interface JiraPlanIssue {
  key: string;
  summary?: string;
  /** Resolved test name, or null when no test covers the issue yet. */
  test: string | null;
}

export interface JiraPlanResolution {
  key: string;
  issues: JiraPlanIssue[];
}

/* ── log analyzer (standalone; the run-detail failure annotation reuses the
      lighter AnalysisReport instead) ──────────────────────────────────────── */
export type EvidenceLevel = "info" | "warn" | "err" | "ok";

export interface AnalyzerEvidence {
  ts: string;
  src: string;
  level: EvidenceLevel;
  text: string;
}

export type AnalyzerActionKind =
  | "open_environment"
  | "open_board"
  | "jump_console"
  | "compare"
  | "retry";

export interface AnalyzerAction {
  label: string;
  /** Semantic action; the UI maps it to a route/behaviour. */
  kind?: AnalyzerActionKind;
}

export interface LogAnalysis {
  severity: FindingSeverity;
  headline: string;
  detail: string;
  evidence: AnalyzerEvidence[];
  likely_cause: string;
  actions: AnalyzerAction[];
}

/** A prior run's captured stdout, offered as an analyzer input. */
export interface PastRunLog {
  id: string;
  what: string;
  log: string;
}

/* ── run output: streamed console + collected artifacts ─────────────────── */
export type ConsoleLevel = "i" | "w" | "e" | "ok";

export interface ConsoleLine {
  ts: number;
  src: string;
  level: ConsoleLevel;
  text: string;
}

/** A file produced by a run (pcap, log, serial dump) — distinct from the
    git-backed code Artifact. */
export interface RunArtifact {
  name: string;
  size: string;
  description: string;
}

/* ── team activity digest (dashboard right rail) ────────────────────────── */
export interface ActivityItem {
  actor: string;
  verb: string;
  target?: string;
  ago?: string;
}

/* ── cross-app handoff (planner → codegen) ───────────────────────────── */

export interface CodegenPrefillStep {
  instruction: string;
  additional_info?: string;
  expected_result?: string;
}

/** Typed payload the planner hands to codegen — never via route state. */
export interface CodegenPrefill {
  name: string;
  description?: string;
  preconditions?: string;
  steps: CodegenPrefillStep[];
}
