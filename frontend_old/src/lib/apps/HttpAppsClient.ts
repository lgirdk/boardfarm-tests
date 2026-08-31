import type {
  AnalyzeLogsInput,
  CodegenGenerateInput,
  JiraIssueType,
  JiraProject,
  JiraSearchQuery,
  JiraSearchResult,
  JiraTicket,
  JiraUser,
  JobRef,
  PlanTestsInput,
} from "@/lib/contracts";
import type { AppsClient } from "./AppsClient";

/** /api/apps/* — see BACKEND_API_CONTRACT.md §3.5. Untested stub. */
export class HttpAppsClient implements AppsClient {
  constructor(private readonly basePath = "/api/apps") {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.basePath}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed (HTTP ${res.status})`);
    return (await res.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`GET ${path} failed (HTTP ${res.status})`);
    return (await res.json()) as T;
  }

  generateCode(input: CodegenGenerateInput): Promise<JobRef> {
    return this.post("/codegen/generate", input);
  }

  planTests(input: PlanTestsInput): Promise<JobRef> {
    return this.post("/planner/plan", input);
  }

  analyzeLogs(input: AnalyzeLogsInput): Promise<JobRef> {
    return this.post("/analyzer/analyze", input);
  }

  /* ── jira ────────────────────────────────────────────────────────────── */

  jiraMe(): Promise<JiraUser> {
    return this.get("/api/jira/me");
  }

  jiraProjects(): Promise<JiraProject[]> {
    return this.get("/api/jira/projects");
  }

  jiraTypes(projectKey: string): Promise<JiraIssueType[]> {
    return this.get(`/api/jira/types?project=${encodeURIComponent(projectKey)}`);
  }

  jiraSearch(query: JiraSearchQuery): Promise<JiraSearchResult[]> {
    return this.post("/api/jira/search", query);
  }

  async fetchJiraTicket(key: string): Promise<JiraTicket> {
    return this.get(`/api/jira/ticket/${encodeURIComponent(key)}`);
  }
}
