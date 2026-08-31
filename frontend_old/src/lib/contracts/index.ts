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
  /** Where it comes from — today always the git repo. */
  source: "git";
  updated_at: number;
}

export interface TestFilter {
  suite?: string;
  tag?: string;
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
