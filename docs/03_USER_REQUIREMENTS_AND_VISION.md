# My Requirements & Ideas

---

## My Vision

I am building a proper UI for the entire boardfarm. This is an entire boardfarm UI. The log analyzer is also a part — it will analyze all the stuff that is run on boardfarm. The codegen is boardfarm again. So it's a one-place boardfarm solution that helps users to maintain, manage, run, execute, create, plan, and all the features.

I want to make a user's life easy in selecting tests, env for it, test selections, test suite creations, automatic test creations. If something is not there then code generation by whatever we have now.

A simple nice flow — not just for codegen or log analyzer — for the entire boardfarm. Including the code generation (yes it's a feature), the log analyzer (yes it's a feature), similarly test executions and planning and the test showing etc. And the inventory config, the env configs.

It should be simple, elegant, cover all the features, and structured.

---

## Rename

- "testforge" / "INTA" → **"Boardfarm-UI"** everywhere (HTML title, sidebar brand, login page)
- Mock Jira user "Sudharani Murali" → **"user-xyz"**

---

## Navigation & Feature Organization

The current design was much better than the first attempt. Where are the available tests? Where are the drafts? Don't remove features.

ALL current features must remain accessible. The earlier codegen is fine and its functionality is good. Available tests, Codegen, Drafts must all remain.

We can enhance things however. Basically this is an entire boardfarm UI.

Library sections should have available tests, the codegen should be in it. The available tests should show all the tests in a proper way — a table list with filter or intent-based like searches, or index-based, or anything proper.

---

## Test Catalog

Should show ALL tests but in a proper way — a table list with filter or intent-based searches. I don't know the exact way — think about it.

---

## Code Generator

Codegen functionalities are proper and it's good. Like the draft — a user will generate code and will have it in the draft till they decide to publish it. That's a good idea.

The current codegen with 3 input modes is good.

---

## Drafts

Drafts are not visible to team unless published.

Once published — goes to git — then team sees it.

---

## Environments

Users need to browse, select, and create environment configs.

The user will maybe create or run the test against — I don't know how it will be portrayed but yes, the env is what the user will maybe create or run the test against.

Mostly the user doesn't need a separate configuration page for this — that's too much back-and-forth.

The env JSON can be selected and also those can be auto-generated because it also depends on the preconditions.

There are several envs but 10 tests run against one — now we are just hardcoded creating those and saving it. What if the user wants custom env as well.

The inventory is mostly static. We are managing the env via REST API.

---

## Beds / Boards

These are boards that will be tested. APIs are there to check if they are locked or not.

Beds are display-only. The user doesn't need to configure something here — just to run a test, correct? Because it will be lots of back-and-forth.

---

## Test Execution

When running a test, user provides: board type + env JSON + test(s). Boardfarm handles reservation, firmware flash, provisioning, execution, cleanup.

The UI displays boardfarm's internal logs — boardfarm actually logs everything. This is the UI that will display it.

---

## Logs

The logs — well boardfarm actually logs everything, this is the UI that will display it.

Not fake `[RESERVE]` prefixes — actual boardfarm output.

---

## Configuration (TOML)

This is not for the user. This is the thing the codegen needs. The user will configure env and inventory.

Keep as slide-over in System section. Regular users don't interact with this.

---

## Pipelines

Multi-step automated workflows stay (ticket→generate→review→PR→run→analyze). This is useful automation for the team.

---

## Log Analyzer

I did not say to remove it. It existed in the original UI and it should remain accessible.

---

## Quick Run

Not sure what the quick run does or what it runs.

---

## Dashboard

I want to think about what the dashboard should show. This is like a team using the boardfarm application.

If someone creates a test, it's in the pool once published — not in the draft anymore — so the team sees it.

---

## Ideas I Have (Not Final — Think About These)

- What if the user wants a custom env as well — env creation/customization
- The env can also be auto-generated because it depends on the preconditions — auto-env from env_req
- Test suite creations, automatic test creations — suite builder concept
- A user will generate code and will have it in the draft till he decides to publish it — draft lifecycle is good

---

## About the Reference Screenshots

These are from my colleague as an idea — he made it with AI Studio of Google. Hence it's not aligned to our world and ideas. Here you come to evaluate, get the understanding of everything, analyze those ideas from the images, understand the requirements and the intent that I even missed. Don't be biased from the images — they are just to tell you the possibilities. You can also think stuff from your own and tell me if that is more relevant.

You can decide on the color as well. Can have this little blues tint. The design and all can be kept what we have, maybe, but think and tell me properly.

**What the screenshots show (factually):**
1. Dashboard with stats row (total/passed/failed/pending), test cards with pass/fail badges and "Run" buttons
2. Config page with execution engine settings + side-by-side JSON editors (inventory + environment) with upload/beautify/validate
3. Test Library & Generator combined on one page with existing tests list and code generation
4. Terminal output pane with timestamped color-coded log lines during execution
5. Settings page with simple toggle preferences
6. Health/telemetry page with cluster status, connected nodes with CPU/MEM/latency

---

## Feedback on the First Implementation Attempt

What the hell have you done? This is the worst transformation — worse than what was there.

Where are the available tests? Where are the drafts? The earlier design was much better.

What about the env stuff? What about the so many things we have discussed?

Where are executions — are they just runs? Where are the configs?

Read exactly thoroughly through every detail message we have shared. Do not rush. Before building, I want exactly how and what is expected — not the design, the features and whatever I told exactly as it is — in an md file.

---

## Backend Integration Status

### Already Built
- Code generation pipeline (FastAPI, Docker Compose)
- Full pipeline: reasoning → skill selection → search → context assembly → code generation

### Already Mocked in Frontend
- Auth, Registries, Persistence (TOML config), Workflows (3 seeded), Runs (timer-driven mock engine), Artifacts, Apps (codegen/planner/analyzer + Jira integration)

### Pending Backend Work
- Real Jira integration (python-jira + PAT storage in user profile)
- Boardfarm execution bridge (trigger runs, stream logs, check bed status)
- Git integration for test catalog and draft publishing
- Real auth (SSO/LDAP)

### Jira Integration
- User stores PAT (Personal Access Token) in their profile
- Backend stores PAT encrypted, uses it for all Jira API calls
- "Connected as {name}" comes from `jira.myself()` API using the stored PAT
- Endpoints already defined in AppsClient interface: jiraMe, jiraProjects, jiraTypes, jiraSearch, fetchJiraTicket
- All already mocked in MockAppsClient with seeded data (12 tickets, 3 projects, standard issue types)
