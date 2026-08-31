# Current Frontend UI — Exact State Description

This describes the EXACT current state of the frontend at `frontend/`. You have NO code access — this is everything.

---

## Tech Stack & Architecture

- **React 18 + TypeScript + Tailwind CSS + Vite**
- **Dark theme only** — instrument panel aesthetic
- **Seam architecture**: Every external dependency behind an interface with Mock + Http implementations, switched by `VITE_USE_BACKEND=1` env var
- **Mock-first**: `npm run dev` works fully with no backend — all data is simulated in-browser
- **Component library**: Custom (no MUI/Chakra) — Radix UI primitives for dialog/select/switch only

## Theme & Design Tokens

**Colors (CSS variables, RGB triplets for Tailwind opacity support):**

| Token | Hex | Usage |
|-------|-----|-------|
| canvas | #0E1116 | Page background (with dot-grid overlay) |
| sidebar | #12161D | Left navigation background |
| surface | #151A21 | Cards, panels |
| surface-raised | #1B222B | Inputs, elevated elements |
| surface-inset | #0E1116 | Code blocks, sunken areas |
| border | #232B36 | Default dividers |
| border-strong | #2A323D | Emphasized borders |
| foreground | #E7ECF2 | Primary text |
| muted | #9AA6B4 | Secondary text |
| faint | #5A6472 | Tertiary/disabled text |
| accent | #818CF8 | Indigo — ALL interactive elements |
| accent-fg | #0E1116 | Text on accent backgrounds |
| ok | #34D399 | Green — pass/success/completed |
| danger | #F87171 | Red — fail/error |
| running | #60A5FA | Blue — in-progress |
| warning | #FBBF24 | Amber — awaiting approval |
| idle | #3A4450 | Gray — pending/hollow |

**Typography:**
- Sans: Inter, ui-sans-serif, system-ui
- Mono: JetBrains Mono, ui-monospace, SFMono-Regular
- Base size: 13px

**Shapes:**
- Card radius: `rounded-[10px]`
- Button/nav radius: `rounded-[7px]`
- Hairline borders throughout
- Dot-grid background: `.bg-dotgrid` (radial-gradient, 24px repeat)

**Animations:**
- `pulse-dot`: 1.6s ease-in-out (running state indicators)
- `halo-wait`: 4px shadow with warning color at 15% opacity
- Respects `prefers-reduced-motion`

**Semantic rule:** Green/red/blue/amber = status ONLY. Indigo = interactive ONLY. Never mix.

---

## Navigation Structure

The sidebar has 4 sections with 9 entries:

```
Apps:
  Dashboard          /           LayoutDashboard icon
  Codegen            /codegen    Code2 icon
  Test planner       /planner    ListChecks icon
  Log analyzer       /analyzer   FileSearch icon

Automation:
  Pipelines          /pipelines  Workflow icon
  Runs               /runs       History icon

Library:
  Available tests    /tests      TestTube icon
  Drafts             /drafts     FolderOpen icon

System:
  Configuration      (slide-over) Settings icon
```

The sidebar:
- Collapsible (52px collapsed, 176px expanded, state saved to localStorage)
- Brand: TestTube2 icon in accent-colored square + "INTA" text (to be renamed "Boardfarm-UI")
- Section labels shown when expanded, horizontal dividers when collapsed
- Active nav: indigo border + subtle accent background
- User chip at bottom: initials avatar + username + logout button

---

## Screen-by-Screen Description

### Dashboard (`/`)
- **Header**: "Dashboard" title + "Signed in as {username} · {workspace}" subtitle
- **Stats grid** (4 cards in a row): registered LLMs count, pipeline stages count, draft artifacts count, runs total
- **"Waiting on you" section**: List of `awaiting_approval` runs — each is a clickable amber card showing run ID, workflow title, paused step, time ago
- **"Recent runs" table**: Last 5 runs in a bordered list — run ID (mono), workflow title, status chip, time ago. Clickable → navigates to run detail
- **Link**: "All runs" link to `/runs`

### Codegen (`/codegen`)
Two-column layout: input (left) | output (right).

**Input column — 3 tab modes:**

1. **Structured steps** (default):
   - Meta form: name (required), description, preconditions — using RecordForm component
   - Steps editor: ordered list of steps, each with instruction (required), additional_info, expected_result
   - Reorder (up/down arrows), add, remove step buttons

2. **Jira ticket**:
   - `JiraTicketPicker` component (see below for full detail)
   - Selected ticket preview: key, summary, description, preconditions, steps

3. **Free text**:
   - Test name input + freeform specification textarea

**"Generate" button**: Disabled until input is valid. Triggers `appsClient.generateCode(payload)` → returns `run_id`.

**Output column:**
- Before run: "Fill in the spec and press Generate…" placeholder
- During run: `JobProgress` component (status chip + mini step trail)
- After complete: Python code viewer with:
  - Syntax highlighting (indigo keywords, amber numbers, faint comments)
  - Filename header (derived from test name)
  - Copy button, Download button
  - "Save as draft" button → creates artifact → success note
- On failure: error message

**Handoff**: Can be pre-filled from Test Planner via `consumeCodegenPrefill()`.

### JiraTicketPicker Component (inside Codegen)
A collapsible panel with advanced Jira search:

**Header**: Jira logo + "JIRA Ticket" + "Select a ticket to pre-fill goal & steps" + collapse toggle

**Connection badge**: Shows "Connected as {name}" (green check) or "Not connected" or "Connecting..."

**Two search modes (toggle):**

1. **Filters mode** (default):
   - Project dropdown (populated from `jiraProjects()`)
   - Issue Type dropdown (populated from `jiraTypes(project)`)
   - Text search input
   - Search button

2. **JQL mode**:
   - Raw JQL input (e.g., `project = PROJ AND issuetype = "XTest"`)
   - Search button

**Results list**: Scrollable, max-height. Each row:
- Left: ticket key (mono, faint) + summary (truncated)
- Right: issue type label + status badge (Done=green, In Progress=blue, Open=gray)

**Selected ticket preview**: Bordered card with accent highlight:
- Key + summary header
- Description paragraph
- Steps list: instruction → expected_result (arrow separator)

**Mock data**: 12 seeded tickets (MVX_TST-*, BF-*), 3 projects (BF, MVX_Tests, DOCSIS_Auto), standard Jira issue types.

### Test Planner (`/planner`)
Two-column: input (left) | results (right).

**Input modes** (radio toggle):
1. **Free-text scenario**: title + multiline description
2. **Jira epic**: title + epic key

**"Plan tests" button** → triggers job → shows JobProgress during execution.

**Output** (after complete): Editable test plan cards:
- Each card: name, preconditions, tags (comma-separated), steps (one per line)
- Cards can be: edited inline, removed, **"Send to codegen"** → handoff to `/codegen`
- "Save plan as draft" → markdown artifact

### Log Analyzer (`/analyzer`)
Two-column: input (left) | results (right).

**Input modes**:
1. **Paste logs**: Large textarea
2. **Pick artifact**: Dropdown of available artifacts

**Output**: Summary paragraph + finding cards (severity badges: critical=red, major=amber, minor=gray), each with message + suspected_cause.

### Pipelines (`/pipelines`)
Grid of workflow cards.

**Three seeded workflows:**

1. **Ticket → tested** (6 steps): pull ticket → generate code → review (gate) → open PR → run on bed → analyze
2. **Plan → generate → tested** (5 steps): plan tests → review plan (gate) → generate code → open PR → run on bed
3. **Nightly sanity** (4 steps, no gates): reserve bed → run sanity suite → analyze failures → publish report

Each card: title, description, step preview (labels with gate indicators in amber). "Run pipeline" button → navigates to `/pipelines/{name}`.

**Pipeline run form** (`/pipelines/{name}`): Dynamic form from `workflow.input_descriptor` (uses RecordForm). "Pause after step" toggles. Validate → trigger → navigate to `/runs/{id}`.

### Runs List (`/runs`)
- **Filter chips**: all, queued, running, awaiting_approval, completed, failed, cancelled
- **Table**: run ID (mono), workflow title, status chip, triggered_by, created (ago), duration
- **Rows clickable** → `/runs/{id}`
- **Polling**: 2.5s interval

### Run Detail (`/runs/{id}`)
The "signature screen" — real-time execution monitoring.

**Layout**: Left rail | Right content panel

**Left rail** (`RunRail`): Vertical step flow visualization
- Each step: dot (colored by state) + name + summary
- States: pending (faint), running (blue, pulsing), completed (green), failed (red), awaiting_approval (amber, glowing), skipped (gray)
- Click step to select it

**Right panel**: Selected step detail
- Step title, label badge, state
- Details table (e.g., Jenkins build info)
- Artifacts (code viewer for generated code)
- If awaiting_approval: "Approve & continue" + "Request changes" buttons

**Run header**: Run ID, workflow title, status chip, cancel button

**Error display**: Red banner with step name + error message

### Available Tests (`/tests`)
- **Suite filter chips** at top: gui, voice, docsis, wifi, networking, etc.
- **Tests grouped by suite** — section headers
- **Per test**: name (mono), tags, env_req summary, updated (ago)
- **Source badge**: "from git"

Mock data: ~30 seeded tests across suites (gui, voice, docsis, wifi, networking, provisioning).

### Drafts (`/drafts`)
- **Filter tabs**: all, draft, published
- **Table**: name (mono), type, status badge (draft=amber, published=green), from run (linked), created (ago)
- **Status badges**: draft (amber "draft" chip), published (green "published" chip)

Mock data: ~8 seeded draft artifacts.

### Configuration (slide-over)
Opens in a right slide-over panel from the sidebar.
- **4 config surfaces**: app.toml, codegen.toml, search.toml, store_config.toml
- **Each surface**: TOML editor with field descriptors, validation, dirty tracking
- **Save flow**: "Review & save" → DiffView (before/after TOML) → confirm → persist

---

## Client Seams (Mock ↔ Http)

| Seam | Interface | Mock | Http |
|------|-----------|------|------|
| auth | login, logout, me | Accepts any non-empty creds | POST/GET /api/auth/* |
| registries | fetch | Seeded catalog (LLMs, encoders, stages) | GET /api/registries |
| persistence | load, save | In-memory TOML docs | GET/POST /api/config/{file} |
| workflows | list, get | 3 seeded workflows | GET /api/workflows |
| runs | trigger, get, list, approve, cancel, subscribe | Timer-driven state machine (engine.ts) | POST/GET /api/runs/* |
| artifacts | list, get, createDraft, publish | In-memory store | GET/POST /api/artifacts/* |
| apps | generateCode, planTests, analyzeLogs, jiraMe, jiraProjects, jiraTypes, jiraSearch, fetchJiraTicket | Pseudo-workflows on shared run engine | POST /api/apps/*, GET /api/jira/* |

**The switch** (in each seam's `index.ts`):
```typescript
const useBackend = import.meta.env.VITE_USE_BACKEND === "1";
export const runsClient: RunsClient = useBackend ? new HttpRunsClient() : new MockRunsClient(runEngine);
```

---

## Routing

```
/login          → LoginPage (public)
/               → Dashboard (index, guarded)
/codegen        → CodegenApp
/planner        → PlannerApp
/analyzer       → AnalyzerApp
/pipelines      → PipelinesApp
/pipelines/:name → PipelineRunPage
/runs           → RunsListPage
/runs/:id       → RunDetailPage
/tests          → AvailableTestsApp
/drafts         → DraftsApp
*               → redirect to /
```

Configuration is NOT routed — it opens in a slide-over from the sidebar.

---

## Key Architectural Rules

1. `npm run dev` with no backend must ALWAYS work fully (mock-first)
2. No `fetch()` in components — only through seams
3. `modules/` imports from `lib/` and `components/`, never the reverse
4. `contracts/` imports nothing
5. Adding a new app = one entry in `registry.ts` — sidebar and router derive from it
6. TypeScript: zero errors, no `any`, no `@ts-ignore`
7. Mock behavior IS the API contract — what MockClient does is what the backend must do
