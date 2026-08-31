# Jira Integration — Backend Implementation Pending

The frontend advanced Jira ticket picker is wired and working with mock data.
Below is everything needed to connect it to a real Jira instance.

## Python Library

```bash
pip install jira
```

## Configuration (env vars or app.toml)

```toml
[jira]
url = "https://your-org.atlassian.net"
email = "service-account@example.com"
token = "<PAT or API token>"
```

Or environment variables:
- `JIRA_URL`
- `JIRA_EMAIL`
- `JIRA_TOKEN`

## Backend Endpoints to Implement

All endpoints are called by the frontend `HttpAppsClient`.

### 1. `GET /api/jira/me`

**Purpose:** Check connection, return authenticated user.

**Jira call:** `jira.myself()`

**Response:**
```json
{
  "display_name": "Sudharani Murali",
  "email": "s.murali@example.com"
}
```

### 2. `GET /api/jira/projects`

**Purpose:** List projects the user can see (for the Project dropdown).

**Jira call:** `jira.projects()`

**Response:**
```json
[
  { "key": "MVX_Tests", "name": "MVX Tests" },
  { "key": "BF", "name": "Boardfarm" }
]
```

### 3. `GET /api/jira/types?project={key}`

**Purpose:** Issue types for a project (for the Type dropdown).

**Jira call:** `jira.project(key).issueTypes`

**Response:**
```json
[
  { "id": "10001", "name": "XTest" },
  { "id": "10002", "name": "Epic" },
  { "id": "10003", "name": "Bug" }
]
```

### 4. `POST /api/jira/search`

**Purpose:** Search tickets by filters or raw JQL.

**Request body:**
```json
{
  "project": "MVX_Tests",
  "issue_type": "XTest",
  "text": "wifi",
  "jql": null
}
```

**Backend logic:**
- If `jql` is provided, use it directly: `jira.search_issues(jql)`
- Otherwise build JQL from filters:
  ```python
  parts = []
  if project: parts.append(f'project = "{project}"')
  if issue_type: parts.append(f'issuetype = "{issue_type}"')
  if text: parts.append(f'text ~ "{text}"')
  jql = " AND ".join(parts) or "ORDER BY updated DESC"
  ```

**Jira call:** `jira.search_issues(jql, maxResults=50)`

**Response:**
```json
[
  {
    "key": "MVX-TST-1985",
    "summary": "Verify LLC filter blocks non-IP traffic on CPE",
    "issue_type": "XTest",
    "status": "Open",
    "updated": "2026-08-20"
  }
]
```

### 5. `GET /api/jira/ticket/{key}`

**Purpose:** Full ticket with Xray test steps (pre-fills the codegen form).

**Jira call:** `jira.issue(key)` + parse Xray custom fields

**Xray step extraction:**
```python
# Xray stores steps in a custom field (varies per instance)
# Common field names: customfield_XXXXX
# The value is usually a dict with "steps" array:
# [{"index": 1, "step": "...", "data": "...", "result": "..."}]

issue = jira.issue(key)
xray_steps_field = "customfield_12345"  # <-- find this in your Jira admin
raw_steps = getattr(issue.fields, xray_steps_field, None)

steps = []
if raw_steps and "steps" in raw_steps:
    for s in raw_steps["steps"]:
        steps.append({
            "instruction": s.get("step", ""),
            "expected_result": s.get("result", ""),
        })
```

**Response:**
```json
{
  "key": "MVX-TST-1985",
  "summary": "Verify LLC filter blocks non-IP traffic on CPE",
  "description": "...",
  "preconditions": "Board provisioned in dual-stack mode",
  "steps": [
    { "instruction": "Reboot the CPE", "expected_result": "Device reboots within 300s" },
    { "instruction": "Check WAN interface", "expected_result": "IPv4 lease present" }
  ]
}
```

## Frontend → Backend Flow

```
1. Page loads     → GET /api/jira/me          → "Connected as ..."
2. Page loads     → GET /api/jira/projects     → fills Project dropdown
3. User picks project → GET /api/jira/types?project=MVX_Tests → fills Type dropdown
4. User clicks Search → POST /api/jira/search  → result list
5. User clicks ticket → GET /api/jira/ticket/{key} → pre-fills codegen form
```

## Frontend Files (already done)

| File | What |
|------|------|
| `lib/contracts/index.ts` | `JiraUser`, `JiraProject`, `JiraIssueType`, `JiraSearchQuery`, `JiraSearchResult` types |
| `lib/apps/AppsClient.ts` | Interface: `jiraMe`, `jiraProjects`, `jiraTypes`, `jiraSearch`, `fetchJiraTicket` |
| `lib/apps/MockAppsClient.ts` | Mock implementations with canned data |
| `lib/apps/HttpAppsClient.ts` | HTTP implementations pointing to `/api/jira/*` |
| `modules/codegen/JiraTicketPicker.tsx` | Advanced picker UI (connection badge, dropdowns, search, result list) |
| `modules/codegen/CodegenApp.tsx` | Integrated — `JiraTicketPicker` replaces old simple ticket ID input |

## Finding the Xray Custom Field ID

```python
from jira import JIRA
j = JIRA(server=URL, basic_auth=(EMAIL, TOKEN))
issue = j.issue("MVX-TST-1985")
for field_name, field_value in issue.raw["fields"].items():
    if field_value and "step" in str(field_value).lower()[:100]:
        print(f"{field_name}: {str(field_value)[:200]}")
```

## Auth Options

| Method | Pros | Cons |
|--------|------|------|
| **Shared API token** (current plan) | Simple, one config | All users see same projects |
| **OAuth 2.0 per-user** | User-specific access | Complex, needs callback URL |
| **PAT per-user** | User-specific, simpler than OAuth | Each user must provide their token |
