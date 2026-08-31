# Frontend Architecture — where everything is and how to extend it

This is the hand-over document for the `frontend/` platform UI ("testforge").
It tells you **where things live**, **how the pieces integrate**, **how to wire a
real backend API**, and **how to extend** the UI with new fields, screens,
clients, pipelines, or apps — so you can take a valid approach without
re-discovering the design.

Companion docs:
- `FRONTEND_COMMANDS.md` (repo root) — every command and what it does.
- `frontend/docs/FRONTEND_GUIDE.md` — React-from-zero teaching guide (concepts, file types, walkthroughs).
- `frontend/docs/BACKEND_API_CONTRACT.md` — the **exact API contract** the backend must implement (every endpoint, shape, and error format). This is the single source of truth for backend work.

---

## 1. The one philosophy to remember

> **Every external dependency sits behind a client interface with a Mock and an
> Http implementation, selected by `VITE_USE_BACKEND`.**

The UI never calls `fetch()` from a component. It calls a **seam** (an
interface). Today the mock implementations simulate the whole platform
in-browser (`npm run dev` alone works, no backend). When a backend endpoint
exists, you flip `VITE_USE_BACKEND=1` and the Http sibling takes over — **zero
component changes**.

```
component ──> seam (interface) ──┬─> Mock…Client   (default; in-browser simulation)
                                 └─> Http…Client   (VITE_USE_BACKEND=1; real API)
```

The **mock behavior IS the API contract**: whatever `MockRunsClient` does is
what `POST /api/runs` must do.

---

## 2. Folder map (what owns what)

```
frontend/
├── index.html                 single page; loads src/main.tsx
├── vite.config.ts             dev server, /api + /boardfarm proxy → :8080, vitest config
├── tailwind.config.ts         design tokens (colors/fonts) — maps to CSS vars
├── package.json               dependencies + npm scripts
└── src/
    ├── main.tsx               boot: AuthProvider > RegistriesProvider > Router
    ├── index.css              ALL color tokens (CSS variables), dot grid, motion
    │
    ├── app/                   THE SHELL — knows nothing about any feature
    │   ├── registry.ts        ★ application registry: every nav entry (id, icon,
    │   │                        section, path, component). Add an app HERE.
    │   ├── router.tsx         routes derived from the registry + /login + detail routes
    │   ├── AppShell.tsx       frame: sidebar + content outlet + settings host
    │   ├── Sidebar.tsx        collapsible nav (renders registry sections) + user chip
    │   ├── LoginPage.tsx      sign-in card (mock accepts anything)
    │   └── SettingsHost.tsx   hosts Config in a slide-over
    │
    ├── lib/                   LOGIC + SEAMS (no feature UI here)
    │   ├── contracts/         ★ shared platform types (Run, WorkflowDef, Artifact,
    │   │                        User, RunStatus…) — mirror these in the backend
    │   ├── auth/              AuthClient seam + AuthContext + RequireAuth guard
    │   ├── workflows/         WorkflowsClient seam + seeded workflow catalog
    │   ├── runs/              RunsClient seam + ★ engine.ts (the mock run state
    │   │                        machine: timers, events, approval gates, failures)
    │   │                        + useRunSubscription hook (live run in a component)
    │   ├── artifacts/         ArtifactsClient seam + shared in-memory artifact store
    │   ├── apps/              AppsClient seam (codegen/planner/analyzer jobs + jira fetch)
    │   ├── registries/        RegistriesClient seam (backend code-derived catalogs:
    │   │                        LLM names, encoder types, stages, categories)
    │   ├── persistence/       PersistenceAdapter seam (TOML config read/write)
    │   ├── schema/            the form engine's data layer: field descriptor types,
    │   │                        descriptor→zod validation, cross-file ref checks,
    │   │                        polymorphic (discriminated-union) helpers
    │   ├── handoff.ts         typed cross-app handoff (planner → codegen prefill)
    │   ├── registry.ts        generic Registry class (used by app/ and config/)
    │   ├── time.ts            fmtDuration / fmtAgo / runDuration
    │   ├── toml.ts            TOML parse/serialize   objectPath.ts / namedMap.ts / cn.ts
    │   └── run/useRun.ts      generic one-shot async op hook (legacy, still usable)
    │
    ├── components/            GENERIC UI — knows nothing about the domain
    │   ├── FieldRenderer.tsx  ★ the ONLY schema-kind → widget map (form engine core)
    │   ├── RecordForm.tsx     renders all fields of one record via FieldRenderer
    │   ├── TextField / SelectField / SwitchField / Field.tsx (label+help+error shell)
    │   ├── NamedCollection / NamedCollectionEditor(→ in modules/config) / ReorderableList
    │   ├── PolymorphicForm    type-switching record (e.g. encoders)
    │   ├── StatusChip         run status → colored chip (the semantic color map)
    │   ├── CodeView           zero-dep python highlighter   CodeBlock / CopyButton
    │   ├── JobProgress        compact run trail for app jobs
    │   ├── SlideOver / ConfirmSaveDialog / DiffView / Button
    │
    ├── schemas/               DESCRIPTOR DATA for the config forms (fields, labels,
    │   │                        help text). Adding a config field = one entry here.
    │   ├── app.schema.ts  store.schema.ts  search.schema.ts  codegen.schema.ts
    │
    └── modules/               FEATURES (one folder each; thin, compose lib+components)
        ├── dashboard/         stats + waiting-on-you + recent runs
        ├── codegen/           3 input modes → generate job → result (+ StepsEditor)
        ├── planner/           scenario → plan job → editable cards → handoff
        ├── analyzer/          logs/artifact → analyze job → findings
        ├── pipelines/         workflow cards + descriptor-driven run form
        ├── runs/              runs table + ★ RunDetailPage (the rail) + runRail.ts
        └── config/            the TOML settings app (4 surfaces, diff-gated save)
```

**Layering rule:** `modules/` may import from `lib/`, `components/`, `schemas/`.
`lib/` and `components/` never import from `modules/`. `contracts/` imports nothing.

---

## 3. The seams — every client, its interface, and its backend endpoint

| Seam (folder in `src/lib/`) | Interface methods | Mock behavior | Backend endpoints (see BACKEND_API_CONTRACT.md §3.5) |
|---|---|---|---|
| `auth/` | `login, logout, me` | accepts any non-empty creds; sessionStorage session | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| `registries/` | `fetch` | seeded catalog mirroring backend registries | `GET /api/registries` |
| `persistence/` | `load(file), save(file, doc)` | in-memory TOML docs seeded from real configs | `GET/POST /api/config/{file_id}` |
| `workflows/` | `list, get` | 3 seeded workflows (2/1/0 approval gates) | `GET /api/workflows`, `GET /api/workflows/{name}` |
| `runs/` | `trigger, get, list, approve, cancel, subscribe` | **real timer-driven state machine** (`engine.ts`) | `POST /api/runs`, `GET /api/runs[/{id}]`, `POST /api/runs/{id}/approve|cancel`; subscribe = polling now, SSE later |
| `artifacts/` | `list, get, createDraft, publish` | shared in-memory store, ~8 seeded drafts | `GET/POST /api/artifacts`, `GET /api/artifacts/{id}`, `POST /api/artifacts/{id}/publish` |
| `apps/` | `generateCode, planTests, analyzeLogs, fetchJiraTicket` | triggers pseudo-workflows on the shared run engine | `POST /api/apps/codegen/generate|planner/plan|analyzer/analyze`, `GET /api/jira/{key}` |

Every seam folder has the same internal shape:

```
lib/<seam>/
├── <Seam>Client.ts       the interface + its types
├── Mock<Seam>Client.ts   in-browser implementation (the reference behavior)
├── Http<Seam>Client.ts   real API implementation (compiles today, used when backend up)
├── seed.ts               canned data for the mock (where applicable)
├── index.ts              ★ the switch:  useBackend ? Http : Mock   — one line
└── *.test.ts             unit tests for the mock behavior
```

---

## 4. How to integrate a real backend API (the exact procedure)

Say you implement `POST /api/runs` and friends on FastAPI:

1. **Read the contract**: `frontend/docs/BACKEND_API_CONTRACT.md` §3.5 defines
   the URL, request/response JSON, and error shapes. The shared types to mirror
   are in `frontend/src/lib/contracts/index.ts` (build a Python equivalent —
   Pydantic models with the same field names).
2. **Match the mock's behavior**, not just the shapes. e.g. `approve()` on a
   run that isn't `awaiting_approval` is an error; `cancel` marks the active
   step `skipped`; `list` returns newest-first. The mock tests
   (`src/lib/runs/engine.test.ts` etc.) read as an executable spec.
3. **Check the Http client**: `src/lib/runs/HttpRunsClient.ts` already calls
   those paths. If your implementation differs (query param names, status
   codes), fix EITHER the backend to match, or the Http client + the contract
   doc together. Never let doc/client/backend disagree.
4. **Dev proxy**: `vite.config.ts` proxies `/api` and `/boardfarm` to
   `http://localhost:8080`. Start the backend (`uvicorn api.app:app --port
   8080` from repo root), then run the frontend with the flag:
   ```bash
   echo "VITE_USE_BACKEND=1" > frontend/.env.local
   npm run dev
   ```
5. **Partial adoption is fine**: each seam's `index.ts` reads the flag
   independently. If only registries + config exist on the backend, you can
   temporarily hardcode one seam's `index.ts` to keep using its Mock while
   others go Http (edit the ternary in that one file).
6. **Live updates**: today `HttpRunsClient.subscribe` polls `GET /api/runs/{id}`
   every 2s. When you add SSE (`GET /api/runs/{id}/events`), change **only**
   the `subscribe` method — every screen keeps working because they consume
   `subscribe`, never the transport.

---

## 5. How to extend — recipes

### 5.1 Add a field to a config form
Add one descriptor object to the right file in `src/schemas/` (e.g.
`app.schema.ts`). Kind, label, help text, `required`, validation format. Done —
rendering, validation, dirty-tracking, TOML diff and save all work. No JSX.

### 5.2 Add a new top-level app (nav entry + screen)
1. Create `src/modules/<name>/<Name>App.tsx`.
2. Register it in `src/app/registry.ts`: `{ id, name, icon, kind: "app",
   section: "apps" | "automation" | "system", path: "<route>", Component }`.
The sidebar and router derive everything from that entry. Detail sub-routes
(like `/runs/:id`) are added in `src/app/router.tsx`.

### 5.3 Add a new backend-dependent feature (new seam)
Copy the folder shape from §3 (interface → Mock → Http → `index.ts` switch →
tests), document the endpoints in `BACKEND_API_CONTRACT.md` §3.5, and put any
shared types in `lib/contracts/`. Components consume only the exported
singleton (e.g. `import { fooClient } from "@/lib/foo"`).

### 5.4 Add a new pipeline (workflow)
Mock-first: add a `WorkflowDef` to `src/lib/workflows/seed.ts`
(`WORKFLOWS_SEED`) — name, steps (mark `gateway: true` for approval pauses),
and an `input_descriptor` using the field-descriptor vocabulary. Add its
mock behavior (step durations, summaries, optional produced artifacts,
optional `failAtStep`) to `MOCK_BEHAVIOR` in the same file. It instantly
appears as a Pipelines card with a working form, live run, gates, and rail.
When the backend serves `GET /api/workflows`, the seed becomes reference data.

### 5.5 Make an app produce/see run results
App jobs return `{run_id}` (see `lib/apps/`). Results are attached to the
completed run's `output` (e.g. `{generated_code}`); screens read them via
`useRunSubscription(runId)` (`src/lib/runs/useRunSubscription.ts`). Follow
`CodegenApp.tsx` as the reference implementation.

### 5.6 Cross-app handoffs (like planner → codegen)
Define a typed payload in `lib/contracts/`, add a setter/consumer pair in
`lib/handoff.ts` (sessionStorage, consumed exactly once), navigate normally.
Never pass complex state through route state.

### 5.7 Change colors / add a theme
All colors are CSS variables in `src/index.css` (`:root`) mapped through
`tailwind.config.ts`. A light theme later = one new `:root`-style block keyed
by `data-theme`, zero component edits. **Semantic rule:** green/red/blue/amber
mean pass/fail/running/awaiting ONLY; indigo (`--accent`) is the only
interactive color.

---

## 6. Key runtime flows (for debugging)

**Boot:** `index.html` → `main.tsx` → `AuthProvider` (calls `authClient.me()`)
→ `RegistriesProvider` (fetches catalogs once) → router. Unauthenticated →
`/login` (the `RequireAuth` guard in `lib/auth/AuthContext.tsx`).

**A pipeline run:** Pipelines card → `/pipelines/:name` form (rendered from
`input_descriptor` by `RecordForm`) → `runsClient.trigger()` → navigate
`/runs/:id` → `useRunSubscription` subscribes → the engine's timer events
re-render the rail → gateway step pauses `awaiting_approval` → "Approve and
continue" calls `runsClient.approve()` → run completes. Artifacts produced by
steps land in the artifact store and render in the right panel by
`step.artifact_ids`.

**An app job (codegen):** input tabs build a `CodegenGenerateInput` →
`appsClient.generateCode()` → `{run_id}` → same subscription machinery →
completed run's `output.generated_code` renders in `CodeView` → "Save as
draft" → `artifactsClient.createDraft`.

**Config save:** surface edits a working copy (`useConfigDoc`) → dirty when
serialized TOML differs → "Review & save" shows `DiffView` → confirm →
`persistence.save()` (Pydantic is the authority once the backend is wired).

---

## 7. Testing map

80 tests, colocated `*.test.ts` next to what they test. The important ones:

| Test file | What it proves |
|---|---|
| `lib/runs/engine.test.ts` | run progression, gates + approve, pause-after, mid-step failure, cancel, events, artifact linking (fake timers) |
| `modules/runs/runRail.test.ts` | rail state derivation + default focus step |
| `lib/workflows/workflows.test.ts` | seed invariants (gate counts 2/1/0, one mid-step failure) |
| `lib/{auth,artifacts,apps,registries}/…` | each mock client's contract behavior |
| `lib/schema/*` + `modules/config/*` | the form engine + config validation rules |

Rule of thumb: **mock clients and pure logic get tests; screens don't** (they
are thin compositions). If you change mock behavior, you are changing the API
contract — update the test AND `BACKEND_API_CONTRACT.md`.

---

## 8. Non-negotiables (don't break these)

1. No `fetch()` in components — only through a seam.
2. No hardcoded catalogs in components (workflow names, LLM names, statuses for
   logic). Data comes from clients/registries; the only compile-time enums are
   the types in `lib/contracts/`.
3. Mock-first: `npm run dev` with no backend must always work fully.
4. Keep the layering (§2). `lib/` never imports `modules/`.
5. Semantic colors are reserved for status (§5.7).
6. `npm run typecheck` zero errors; no `any`, no `@ts-ignore`; keep the tests green.
