import type { JiraWorkspaceConfig, JiraConnection, JiraAuthMethod } from "@/lib/contracts";

/**
 * Mock Jira configuration store. In a real app, workspace config is a backend
 * API call (admin-only write, all users read). Per-user connection state is
 * stored per-user in the backend DB, encrypted.
 *
 * For the mock, both live in memory with defaults matching a Data Center
 * deployment at jira.lgi.nl with PAT auth.
 */

const JIRA_CONFIG_KEY = "bf-jira-config";
const JIRA_CONN_KEY = "bf-jira-connection";

// ── Workspace config (admin sets this) ──────────────────────────────

let workspaceConfig: JiraWorkspaceConfig = {
  deployment: "data_center",
  base_url: "https://jira.lgi.nl",
  allowed_auth: ["pat"],
  enabled: true,
};

// Try to restore from localStorage
try {
  const stored = localStorage.getItem(JIRA_CONFIG_KEY);
  if (stored) workspaceConfig = JSON.parse(stored) as JiraWorkspaceConfig;
} catch {
  // use defaults
}

export function getJiraConfig(): JiraWorkspaceConfig {
  return { ...workspaceConfig };
}

export function updateJiraConfig(patch: Partial<JiraWorkspaceConfig>): JiraWorkspaceConfig {
  workspaceConfig = { ...workspaceConfig, ...patch };
  try {
    localStorage.setItem(JIRA_CONFIG_KEY, JSON.stringify(workspaceConfig));
  } catch {
    // storage unavailable
  }
  return { ...workspaceConfig };
}

// ── Per-user connection (each user connects individually) ───────────

let connection: JiraConnection = { connected: false };

try {
  const stored = sessionStorage.getItem(JIRA_CONN_KEY);
  if (stored) connection = JSON.parse(stored) as JiraConnection;
} catch {
  // use defaults
}

export function getJiraConnection(): JiraConnection {
  return { ...connection };
}

/**
 * Simulate connecting to Jira. In a real app this would:
 * - PAT: POST /api/jira/connect { method: "pat", token } → backend calls
 *   GET {base_url}/rest/api/2/myself with the token
 * - OAuth: redirect to Atlassian, exchange code for token on callback
 */
export async function connectJira(
  method: JiraAuthMethod,
  _token?: string,
): Promise<JiraConnection> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600));

  // In a real app, the backend validates the token against Jira
  // and returns the Jira user info. Here we simulate success.
  connection = {
    connected: true,
    username: "ahazra",
    display_name: "Arindam Hazra",
    method,
    connected_at: Date.now(),
  };

  try {
    sessionStorage.setItem(JIRA_CONN_KEY, JSON.stringify(connection));
  } catch {
    // storage unavailable
  }
  return { ...connection };
}

export async function disconnectJira(): Promise<JiraConnection> {
  await new Promise((r) => setTimeout(r, 200));
  connection = { connected: false };
  try {
    sessionStorage.removeItem(JIRA_CONN_KEY);
  } catch {
    // ignore
  }
  return { ...connection };
}
