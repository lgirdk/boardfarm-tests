import type {
  AnalyzeLogsInput,
  CodegenGenerateInput,
  JiraIssueType,
  JiraPlanResolution,
  JiraProject,
  JiraSearchQuery,
  JiraSearchResult,
  JiraTicket,
  JiraUser,
  JobRef,
  PlanTestsInput,
} from "@/lib/contracts";

/**
 * App-invocation seam: codegen / planner / analyzer. Every invocation returns
 * a run id, never a synchronous result — results and progress arrive through
 * RunsClient.subscribe(run_id). This keeps single-app jobs and multi-step
 * pipelines on the same Run backbone (one Runs list, one detail screen).
 */
export interface AppsClient {
  generateCode(input: CodegenGenerateInput): Promise<JobRef>;
  planTests(input: PlanTestsInput): Promise<JobRef>;
  analyzeLogs(input: AnalyzeLogsInput): Promise<JobRef>;

  /* ── jira integration ───────────────────────────────────────────────── */

  /** Check Jira connection, return the authenticated user. */
  jiraMe(): Promise<JiraUser>;
  /** List projects the authenticated user can see. */
  jiraProjects(): Promise<JiraProject[]>;
  /** Issue types available in a given project. */
  jiraTypes(projectKey: string): Promise<JiraIssueType[]>;
  /** Search tickets by project, type, text, or raw JQL. */
  jiraSearch(query: JiraSearchQuery): Promise<JiraSearchResult[]>;
  /** Pull a Jira ticket to prefill the codegen input (read-only preview). */
  fetchJiraTicket(key: string): Promise<JiraTicket>;
  /** Resolve a Jira test plan's issues to tests in the library (read-only). */
  resolveJiraPlan(planKey: string): Promise<JiraPlanResolution>;
}
