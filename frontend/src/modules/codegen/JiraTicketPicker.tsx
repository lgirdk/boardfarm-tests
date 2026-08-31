import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, CircleCheck, Search } from "lucide-react";
import { Button } from "@/components/Button";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { appsClient } from "@/lib/apps";
import { cn } from "@/lib/cn";
import type {
  JiraIssueType,
  JiraProject,
  JiraSearchResult,
  JiraTicket,
  JiraUser,
} from "@/lib/contracts";

type SearchMode = "filters" | "jql";

interface JiraTicketPickerProps {
  onSelect: (ticket: JiraTicket) => void;
}

/**
 * Advanced Jira ticket picker — connection badge, project/type dropdowns,
 * text or JQL search, and result list. Selecting a ticket fetches its full
 * details (including Xray steps) and calls `onSelect`.
 */
export function JiraTicketPicker({ onSelect }: JiraTicketPickerProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Connection
  const [user, setUser] = useState<JiraUser | null>(null);
  const [connError, setConnError] = useState<string>();

  // Filter state
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [types, setTypes] = useState<JiraIssueType[]>([]);
  const [project, setProject] = useState("");
  const [issueType, setIssueType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("filters");
  const [jql, setJql] = useState("");

  // Results
  const [results, setResults] = useState<JiraSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  // Selected ticket
  const [selected, setSelected] = useState<JiraTicket | null>(null);
  const [fetching, setFetching] = useState(false);

  // On mount: check connection + load projects
  useEffect(() => {
    appsClient
      .jiraMe()
      .then(setUser)
      .catch(() => setConnError("Not connected to Jira"));
    appsClient
      .jiraProjects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  // When project changes: load types
  useEffect(() => {
    if (!project) {
      setTypes([]);
      return;
    }
    appsClient
      .jiraTypes(project)
      .then(setTypes)
      .catch(() => setTypes([]));
  }, [project]);

  async function handleSearch() {
    setSearching(true);
    setSearchError(undefined);
    setResults([]);
    setSelected(null);
    try {
      const res = await appsClient.jiraSearch(
        searchMode === "jql"
          ? { jql }
          : {
              project: project || undefined,
              issue_type: issueType || undefined,
              text: searchText || undefined,
            },
      );
      setResults(res);
      if (res.length === 0) setSearchError("No tickets matched.");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(key: string) {
    setFetching(true);
    try {
      const ticket = await appsClient.fetchJiraTicket(key);
      setSelected(ticket);
      onSelect(ticket);
    } catch {
      /* ignore */
    } finally {
      setFetching(false);
    }
  }

  const projectOptions = [
    { value: "", label: "All" },
    ...projects.map((p) => ({ value: p.key, label: p.name })),
  ];
  const typeOptions = [
    { value: "", label: "All" },
    ...types.map((t) => ({ value: t.name, label: t.name })),
  ];

  return (
    <div className="rounded-[10px] border border-border bg-surface">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <JiraIcon />
        <span className="text-sm font-semibold text-foreground">
          JIRA Ticket
        </span>
        <span className="flex-1 text-xs text-muted">
          Select a ticket to pre-fill goal &amp; steps
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-border px-4 py-3">
          {/* Connection badge */}
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <CircleCheck className="h-4 w-4 text-green-500" />
                  <div className="text-xs">
                    <div className="text-muted">Connected as</div>
                    <div className="font-medium text-foreground">
                      {user.display_name}
                    </div>
                  </div>
                </>
              ) : connError ? (
                <span className="text-xs text-danger">{connError}</span>
              ) : (
                <span className="text-xs text-muted">Connecting…</span>
              )}
            </div>
            <p className="flex-1 text-[11px] leading-relaxed text-muted">
              — Search and select <strong>one ticket</strong>; its summary and
              acceptance criteria will pre-fill the goal &amp; steps.
            </p>
          </div>

          {/* Search mode toggle */}
          <div className="mt-3 flex gap-1.5">
            {(["filters", "jql"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSearchMode(m)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs transition",
                  searchMode === m
                    ? "bg-accent/15 text-foreground font-medium"
                    : "text-muted hover:text-foreground",
                )}
              >
                {m === "filters" ? "Filters" : "JQL"}
              </button>
            ))}
          </div>

          {/* Filter mode */}
          {searchMode === "filters" && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Project"
                  value={project}
                  onChange={setProject}
                  options={projectOptions}
                />
                <SelectField
                  label="Type"
                  value={issueType}
                  onChange={setIssueType}
                  options={typeOptions}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label=""
                    value={searchText}
                    onChange={setSearchText}
                    placeholder="Search text..."
                  />
                </div>
                <Button
                  variant="primary"
                  disabled={searching}
                  onClick={() => void handleSearch()}
                >
                  <Search className="h-4 w-4" />
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>
            </div>
          )}

          {/* JQL mode */}
          {searchMode === "jql" && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label=""
                  value={jql}
                  onChange={setJql}
                  placeholder='e.g. project = PROJ AND issuetype = "XTest"'
                />
              </div>
              <Button
                variant="primary"
                disabled={searching || !jql.trim()}
                onClick={() => void handleSearch()}
              >
                <Search className="h-4 w-4" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>
          )}

          {/* Error */}
          {searchError && (
            <p className="mt-2 text-xs text-danger">{searchError}</p>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-border">
              {results.map((r) => (
                <button
                  key={r.key}
                  onClick={() => void handleSelect(r.key)}
                  disabled={fetching}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0",
                    "hover:bg-surface-raised/60 transition",
                    selected?.key === r.key && "bg-accent/10",
                  )}
                >
                  <span className="shrink-0 font-mono text-[11px] text-faint w-28">
                    {r.key}
                  </span>
                  <span className="flex-1 truncate text-xs text-foreground">
                    {r.summary}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">
                    {r.issue_type}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                      r.status === "Done"
                        ? "bg-green-500/10 text-green-600"
                        : r.status === "In Progress"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-surface-raised text-muted",
                    )}
                  >
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected ticket preview */}
          {selected && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3.5 py-3">
              <div className="font-mono text-[11px] text-faint">
                {selected.key}
              </div>
              <div className="mt-0.5 text-[12.5px] font-medium text-foreground">
                {selected.summary}
              </div>
              {selected.description && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                  {selected.description}
                </p>
              )}
              {selected.steps.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {selected.steps.map((s, i) => (
                    <div key={i} className="text-[11.5px] text-muted">
                      <span className="font-mono text-faint">{i + 1}.</span>{" "}
                      {s.instruction}
                      {s.expected_result && (
                        <span className="text-faint">
                          {" "}
                          → {s.expected_result}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JiraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M11.53 2c0 5.46 4.15 9.91 9.47 9.91v1.18c-5.32 0-9.47 4.45-9.47 9.91h-1.06c0-5.46-4.15-9.91-9.47-9.91v-1.18c5.32 0 9.47-4.45 9.47-9.91h1.06z"
        fill="#2684FF"
      />
    </svg>
  );
}
