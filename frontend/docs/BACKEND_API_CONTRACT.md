# Backend API Contract & Frontend Dynamic-Data Plan

> **Status:** in progress — frontend is being made dynamic against a documented
> contract. The backend endpoints described below need to be implemented; until
> then the UI runs on `MockHttpAdapter` / `MockRegistriesClient` (no backend
> required).

This document is the **single source of truth** for what data the frontend needs
from the backend, why each endpoint exists, and how the UI degrades gracefully
when the backend isn't running. Read it before changing either side.

---

## 1. The decision: where does the schema live?

A long design discussion led to a deliberate split. The frontend does **NOT**
fetch a JSON Schema for the entire form (that path leads to polluting Pydantic
models with UI concerns like `ui:order`, `ui:widget`, `ui:placeholder`). Instead:

| Layer | Source of truth | Why |
|---|---|---|
| **Catalog data** (registered LLM names, encoder types, stage names, filter names, prompt variants, output types) | **Backend** | These are *derived from code* — `LLM_CLIENT_REGISTRY`, enums in `src/codegen/enums.py`, `SEARCH_FILTER_REGISTRY`. The frontend cannot know them without lying. |
| **Field descriptors** (which fields exist, labels, help text, polymorphic dispatch, ordering, conditional visibility, format hints) | **Frontend** (`src/schemas/*.ts`) | These are UX concerns. The backend doesn't care how a form is laid out. |
| **TOML content** (the actual saved values) | **Backend** | The files live on disk; the backend reads/writes them. |
| **Authoritative validation on save** | **Backend** (Pydantic) | Pydantic is the gate. Frontend `zod` is UX-only for instant inline feedback. |
| **UX validation for instant feedback** | **Frontend** (Zod, cross-ref checks) | Frontend mirrors Pydantic's rules locally so users see errors as they type. The backend's verdict is final. |

This split keeps the boundaries clean:

- **Backend changes** that add a new LLM client class or a new enum variant
  reach the UI **automatically** through `/api/registries`. No frontend deploy
  needed.
- **UI changes** (rename a label, add a help string, reorder fields) don't
  touch the backend.
- **Pydantic stays pure** (no UI-only metadata pollution).

---

## 2. What the frontend currently hardcodes (and shouldn't)

These are baked into `src/schemas/*.ts` and `src/lib/persistence/seed.ts` today
because we had no other source. They must come from the backend:

| Hardcoded | Source today | Replace with |
|---|---|---|
| LLM client names (`sonnet`, `custome_gpt4o`, `openai_llm`, `gemma4_26B_8bit`) | `seed.ts` `app.llm.*` keys | `/api/registries.llm_clients` |
| Provider labels (`anthropic`, `openai`) | inline in seed | derived from registry entry's `provider` field |
| Encoder types (`sentence_transformer`, `openai`) | `store.schema.ts` polymorphic variants | `/api/registries.encoder_types` |
| Codegen stage names (`reasoning`, `search`, `generation`) | implicit in `codegen.schema.ts` (read from doc keys) | `/api/registries.codegen_stages` (validate UI assumptions match backend) |
| Filter names (`repo_priority_order`, `exclude_repos`) | `store.schema.ts` `filtersSchema` | `/api/registries.search_filters` |
| Prompt variants (`standard`, `compact`) | `codegen.schema.ts` `profileMetaSchema.prompt_variant.options` | `/api/registries.prompt_variants` |
| Output types (`pytest`, `robot`) | implicit (codegen always sends `pytest`) | `/api/registries.output_types` |
| Stub-index categories (`use_cases`, `templates`, …) | `search.schema.ts` `CATEGORY_OPTIONS` | `/api/registries.stub_categories` (optional — these are data-derived, not registry-derived) |

---

## 3. Backend endpoints needed

All endpoints are scoped under `/api/` to keep them clearly distinct from the
existing `/boardfarm/*` codegen endpoint. Each entry below specifies the URL,
why it exists, the exact JSON shape the UI expects, and the priority.

### 3.1 Tier 0 — Required to stop frontend hardcoding ⭐

#### `GET /api/registries`

**Why:** The single biggest win. Every dropdown that's currently hardcoded
becomes dynamic. Without this endpoint the UI silently drifts from the backend.

**Implementation effort:** ~30 lines of Python. Pure introspection — no
business logic. Read `LLM_CLIENT_REGISTRY.names`, iterate over `CodegenPromptVariant`,
`CodegenOutputType`, `IncludeEntryResolveStrategy`, `_CodegenStages.model_fields`,
the `SEARCH_FILTER_REGISTRY` keys, and the encoder discriminator literals.

**Request:** no body, no query params.

**Response (200 OK):**
```json
{
  "llm_clients": [
    {
      "name": "sonnet",
      "client_class": "AnthropicClient",
      "provider": "anthropic"
    },
    {
      "name": "custome_gpt4o",
      "client_class": "CustomeOpenAIGPT4oClient",
      "provider": "openai"
    },
    {
      "name": "openai_llm",
      "client_class": "OpenAIClient",
      "provider": "openai"
    },
    {
      "name": "gemma4_26B_8bit",
      "client_class": "CustomeOpenAIGPT4oClient",
      "provider": "openai"
    }
  ],
  "encoder_types": ["sentence_transformer", "openai"],
  "search_filters": ["repo_priority_order", "exclude_repos"],
  "codegen_stages": ["reasoning", "search", "generation"],
  "prompt_variants": ["standard", "compact"],
  "output_types": ["pytest", "robot"],
  "include_strategies": ["by_names", "by_category", "by_repo"],
  "stub_categories": [
    "use_cases", "templates", "device_apis", "lib_utils",
    "dataclasses", "exceptions", "fixtures", "other"
  ]
}
```

**Field semantics:**

| Field | Backend source | Notes |
|---|---|---|
| `llm_clients[].name` | key in `LLM_CLIENT_REGISTRY._clients` | The TOML `[llm.<name>]` table key must match one of these |
| `llm_clients[].client_class` | `cls.__name__` of the registered class | Informational; rendered in UI tooltips |
| `llm_clients[].provider` | derived (see below) | For UI labelling. Map from class name: `AnthropicClient → anthropic`, `OpenAIClient → openai`, `CustomeOpenAIGPT4oClient → openai`. If you don't want to derive, hardcode the mapping in the endpoint. |
| `encoder_types` | `Literal` arms of `_EncoderEntry` discriminator | The polymorphic `encoder_type` field's allowed values |
| `search_filters` | `SEARCH_FILTER_REGISTRY.keys()` | Names of fields shown under `[filters]` |
| `codegen_stages` | `ResolvedPipeline.stage_names()` | Order matters; preserve insertion order if the backend has a defined order, otherwise sort alphabetically |
| `prompt_variants` | `CodegenPromptVariant` enum values | Used for the `prompt_variant` dropdown in profile editor |
| `output_types` | `CodegenOutputType` enum values | Used by codegen "Generate" button (today only `pytest` is wired) |
| `include_strategies` | `IncludeEntryResolveStrategy` enum values | Future use (force-include hook editor) |
| `stub_categories` | optional — see below | Best effort; if not derivable, omit and the UI keeps its hardcoded list |

**About `stub_categories`:** these come from the stub index data, not from a
code registry. If easy, derive from
`StubCodeRegistry.search_corpus.keys → parse_key().category` (unique values).
If hard, omit — the UI has a hardcoded fallback list.

**Caching:** the response is stable for the process lifetime. Set
`Cache-Control: public, max-age=60` so the UI can re-fetch cheaply.

**Errors:** 500 if the orchestrator hasn't initialized. UI handles this and
falls back to hardcoded enums with a banner.

---

#### `GET /api/config/{file_id}`

**Why:** Lets the UI load the current TOML files. Today the UI uses an
in-memory `MockAdapter` seeded from the real files. This endpoint replaces it.

**Path parameters:**

| `file_id` | Backend file |
|---|---|
| `app` | `configs/app.toml` |
| `store` | `configs/search_store/store_config.toml` |
| `codegen` | `configs/codegen/codegen.toml` |
| `search` | `configs/codegen/search.toml` |

**Response (200 OK):** The TOML parsed as JSON (any structure — passthrough).
```json
{
  "llm": {
    "sonnet": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-5",
      "api_key_env": "ANTHROPIC_API_KEY"
    },
    ...
  },
  "search_store": { "store_config_path": "./configs/search_store/store_config.toml" },
  "codegen": { ... }
}
```

**Errors:**

| Status | Body | When |
|---|---|---|
| 404 | `{"detail": "Unknown file_id: 'xyz'"}` | Invalid path parameter |
| 500 | `{"detail": "..."}` | TOML parse failure or file missing |

---

#### `POST /api/config/{file_id}`

**Why:** Persist edits. Pydantic must validate before write — the UI relies on
the backend returning structured `issues` on validation failure (not just a 422).

**Request body:** The full document as JSON (same shape as `GET` returns).
```json
{
  "llm": { "sonnet": { ... } },
  ...
}
```

**Query params (optional):**

| Param | Meaning |
|---|---|
| `dry_run=true` | Validate only; do not write |

**Response — success (200 OK):**
```json
{ "ok": true }
```

**Response — validation failure (200 OK, NOT 422):**
```json
{
  "ok": false,
  "issues": [
    {
      "location": "llm.sonnet.model",
      "message": "field required"
    },
    {
      "location": "codegen.stages.reasoning.profile",
      "message": "unknown profile 'missing'"
    }
  ]
}
```

> Note: validation failures use `200 OK` with `{ok: false}` because they are
> **expected** user-input errors, not server faults. The UI doesn't have to
> branch on HTTP status — it just reads `ok`.

**Response — write failure (500):**
```json
{ "detail": "Could not write configs/app.toml: Permission denied" }
```

**Validation rules to enforce:**
- All Pydantic models in `src/codegen/config_schema.py` and `src/search_store/config_schema.py`
- Cross-file references (codegen.stages[*].llm → app.llm, codegen.stages[*].profile → codegen.profiles, search.encoder → store.encoders) — these are currently scattered; consolidate into a single validate step that loads all 4 files together when validating any one

---

### 3.2 Tier 1 — Required for UX parity (build after Tier 0 lands)

#### `POST /api/config/{file_id}/validate`

**Why:** Instant validation without writing. The UI calls this on form change
(debounced) so users get the exact same errors Pydantic will give on save.
Eliminates Zod/Pydantic drift.

Same request/response shape as `POST /api/config/{file_id}?dry_run=true`. The
dedicated URL is for cacheability and clarity.

#### `POST /api/orchestrator/dry-run`

**Why:** Cross-file validation. If a user is editing search.toml and adds an
`encoder` that doesn't exist in store.toml, single-file validation can't catch
that. This endpoint runs the orchestrator's resolve pipeline (without actually
building the search engine / LLM pool) and reports any cross-file issues.

**Request body:** All 4 files together:
```json
{
  "app": { ... },
  "store": { ... },
  "codegen": { ... },
  "search": { ... }
}
```

**Response:** Same shape as `POST /api/config/{file_id}` — `{ok}` or `{ok, issues}`.

#### `GET /api/orchestrator/status`

**Why:** Lets the Dashboard show real stats (not placeholders).

**Response:**
```json
{
  "initialized": true,
  "apps": ["codegen"],
  "shared_services": ["llm_pool", "search_store_service"],
  "llm_clients_loaded": ["sonnet"],
  "config_files_in_use": {
    "app": "configs/app.toml",
    "store": "configs/search_store/store_config.toml",
    "codegen": "configs/codegen/codegen.toml",
    "search": "configs/codegen/search.toml"
  }
}
```

`llm_clients_loaded` reports which LLMs have been actually *instantiated* (via
`LLMPool.get()`), not just configured. Useful for "is my Anthropic key working?"
type diagnostics.

---

### 3.3 Tier 2 — Future (pipelines, async jobs)

These are documented for awareness but NOT to be built yet.

#### `GET /api/pipelines`
Lists named cross-app pipelines (per the orchestrator pipelines design).
**Build when you have ≥ 1 actual pipeline.**

#### `POST /api/pipelines/{name}/run`
Runs a named pipeline with a typed input payload.
**Build when you have ≥ 1 actual pipeline.**

#### `POST /api/codegen/generate` → returns `{job_id}`, plus `GET /api/jobs/{job_id}`
Async generation. **Build when sync codegen blocking exceeds acceptable HTTP timeout** (currently fine — codegen takes 30s, users will wait).

#### `POST /api/llm/test/{name}`
Pings an LLM with a hello-world call to verify the API key works.
**Build when users complain.**

---

### 3.5 Platform endpoints (auth, workflows, runs, artifacts, apps) ⭐ NEW

The platform UI (login, pipelines, runs, artifacts, app jobs) is built
mock-first against these contracts. The mock clients in
`src/lib/{auth,workflows,runs,artifacts,apps}` ARE the reference behavior; the
Http siblings already call these paths. Shared types live in
`frontend/src/lib/contracts/` and must be mirrored by a backend
`src/contracts/`.

**Run status enum (contract):** `queued | running | awaiting_approval | completed | failed | cancelled`.

#### Auth (cookie session)

| Endpoint | Behavior |
|---|---|
| `POST /api/auth/login` | Body `{username, password}` → `User` (`{username, display_name, initials, workspace:{id,name}}`), sets session cookie. 401 on bad credentials. |
| `POST /api/auth/logout` | Clears the session. |
| `GET /api/auth/me` | `User` for the session, or **401** when signed out (the UI treats 401 as "show login", not an error). |

#### Workflows

| Endpoint | Behavior |
|---|---|
| `GET /api/workflows` | `WorkflowDef[]` — `{name, title, description, steps:[{name,title,approval?,label?,summary?}], input_descriptor}`. Workflows are STATIC, backend-authored; the user only triggers + approves. `approval: true` steps pause the run for human review. `label` is an optional free-text display hint (e.g. "jenkins") — the frontend just prints it, never infers it. `input_descriptor` uses the frontend field-descriptor shape and is rendered by the existing form engine. |
| `GET /api/workflows/{name}` | One `WorkflowDef`, 404 if unknown. |

#### Runs

| Endpoint | Behavior |
|---|---|
| `POST /api/runs` | Body `{workflow, input, pause_after?: string[]}` → `Run` (created `queued`). One generic trigger endpoint for ALL workflows — the frontend passes the workflow `name` it got from `GET /api/workflows` plus the user's input. `pause_after` adds user-selected approval points on top of the workflow's own `approval` steps. |
| `GET /api/runs` | `Run[]`, newest first. Query: repeated `status=` values, `workflow=`. |
| `GET /api/runs/{id}` | One `Run`, 404 if unknown. |
| `POST /api/runs/{id}/approve` | Resumes a run in `awaiting_approval` (starts the gated step). 409 if not awaiting. |
| `POST /api/runs/{id}/cancel` | Cancels a non-terminal run; the active step becomes `skipped`. |
| *live updates* | The frontend `RunsClient.subscribe(runId, onEvent)` currently polls `GET /api/runs/{id}` (2s). When SSE lands (`GET /api/runs/{id}/events`), only `HttpRunsClient.subscribe` changes. Events carry a full `Run` snapshot. |

`Run` shape: `{id, workflow, workflow_title, status, triggered_by, workspace,
created_at, started_at?, finished_at?, steps:[{name,title,approval?,label?,state,details?,
summary?,started_at?,finished_at?,artifact_ids?}], current_step?, error?:{step,
message}, input?, pause_after?, output?}`. Step `state`: `pending | running |
awaiting_approval | completed | failed | skipped`.

#### Available tests (git-backed catalog)

The real runnable tests live in **git**; the backend reads the repo (test files +
their `@pytest.mark.env_req` markers) and serves a structured catalog. The
frontend only displays it — it is NOT the same as Drafts (AI outputs).

| Endpoint | Behavior |
|---|---|
| `GET /api/tests?suite=…&tag=…` | `TestAsset[]` — `{id, name, path, suite, tags, env_req?, source:"git", updated_at}`, grouped in the UI by `suite` (the repo's area: docsis/wifi/voice/gui/…). Used to pick tests to run or schedule. |

#### Artifacts (Drafts)

These are AI-produced outputs (code/plan/analysis), draft until published.
**Publishing = committing to git**, after which the item appears in Available
Tests above.

| Endpoint | Behavior |
|---|---|
| `GET /api/artifacts?workspace=…` | `Artifact[]` for the workspace. Filters: `status=draft\|published`, `type=`, `run_id=`. |
| `GET /api/artifacts/{id}` | One `Artifact` (`{id,name,type,workspace,status,created_at,version,content,language?,run_id?,step?}`), 404 if unknown. |
| `POST /api/artifacts` | Create a draft (body: name/type/workspace/content + optional language/run_id/step) → `Artifact`. |
| `POST /api/artifacts/{id}/publish` | Publishes a draft → `{ok, url}` where `url` is the created merge request. |

#### App invocations (async jobs)

Every app invocation returns `{run_id}`; progress and results arrive through
the Runs endpoints above (single-app jobs are runs like any pipeline run).
Results attach to the completed run's `output` field.

| Endpoint | Input → `output` on the completed run |
|---|---|
| `POST /api/apps/codegen/generate` | `CodegenGenerateInput` (mirrors backend `CodegenTestInput`) → `{generated_code: string}` |
| `POST /api/apps/planner/plan` | `{title, source: "free-text"\|"jira-epic", scenario?, epic_key?}` → `{plan: TestPlan}` (`{title, source, tests:[{name, preconditions?, tags, steps}]}`) |
| `POST /api/apps/analyzer/analyze` | `{logs?}` or `{artifact_id?}` → `{report: {summary, findings:[{severity: critical\|major\|minor, message, suspected_cause}]}}` |
| `GET /api/jira/{key}` | Pulls a ticket for the codegen preview: `{key, summary, description?, preconditions?, steps:[{instruction, expected_result?}]}` |

> These supersede the older Tier-2 sketches (`/api/pipelines`,
> `/api/codegen/generate` + `/api/jobs/{id}`) above — the UI now standardises
> on workflows + runs.

---

### 3.4 Existing endpoint that needs a fix (not new)

#### `POST /boardfarm/generate`

This **already exists** but is broken — `api/routers/codegen.py:38` references
`orc.codegen_driver_agent` which no longer exists after the orchestrator
refactor. Fix to `orc.codegen_app.generate(payload, output_task_type=...)`.
One-line change. The frontend's `HttpCodegenClient` already calls this URL
correctly.

Eventually move this to `/api/codegen/generate` for consistency, but a redirect
or alias keeps backward compatibility.

---

## 4. Frontend changes (what's being implemented now)

### 4.1 New module: `src/lib/registries/`

A new seam parallel to the existing persistence and codegen-client seams:

```
src/lib/registries/
├── RegistriesClient.ts         # interface + types
├── MockRegistriesClient.ts     # returns canned data (default)
├── HttpRegistriesClient.ts     # calls /api/registries (when backend up)
├── RegistriesContext.tsx       # React context + provider + hook
├── seed.ts                     # canned data for the mock
└── index.ts                    # picks active client via VITE_USE_BACKEND
```

**The data flow:**

1. `<RegistriesProvider>` wraps the app at the root (in `main.tsx`)
2. On mount, the provider calls `client.fetch()` once
3. Children consume via `useRegistries()` hook
4. While loading, a slim "Loading platform data…" splash is shown
5. On failure, falls back to seeded mock data + shows a non-blocking banner

**Why a context not a direct fetch:** the registries are needed in ~5 places
(LLM surface, encoders surface, search surface, codegen schema, profile editor).
Refetching each time is wasteful; prop-drilling is ugly; context is the right tool.

### 4.2 Schema refactor: descriptors become functions of registries

Today:
```typescript
export const llmItemSchema: ObjectSchema = { ... };  // static
```

After:
```typescript
export function makeLlmItemSchema(registries: Registries): ObjectSchema { ... };
```

Surfaces call the factory with the live registries data. Static descriptors
that don't need registry data stay as values.

### 4.3 Persistence: add MockHttpAdapter

New file `src/lib/persistence/MockHttpAdapter.ts` — same `PersistenceAdapter`
interface but with simulated latency (300ms) so loading states are visible.
Defaults are unchanged (still `MockAdapter` for speed); flip the import in
`src/lib/persistence/index.ts` to try the simulated version.

### 4.4 HTTP adapters: write `HttpAdapter` (was missing)

The codegen path already has `HttpCodegenClient`. The config path has only the
in-memory `MockAdapter`. This task adds:

```
src/lib/persistence/HttpAdapter.ts
```

Calls `GET /api/config/{file_id}` and `POST /api/config/{file_id}`. Activates
when `VITE_USE_BACKEND=1`.

### 4.5 Toggle: `VITE_USE_BACKEND`

This env var already toggles the codegen client. After this refactor it also
toggles:
- The registries client (`Mock` ↔ `Http`)
- The persistence adapter (`Mock` ↔ `Http`)

A single switch puts the whole UI on the real backend.

---

## 5. The mock-first principle

> **The UI must always run with `npm run dev` alone, no backend.**

This is non-negotiable for developer ergonomics and demo'ability. Implementation
rule: every HTTP-shaped client has a mock sibling, picked by `VITE_USE_BACKEND`.

```
┌─────────────────────┐    interface     ┌──────────────────────┐
│  CodegenClient      │◄─────────────────┤  MockCodegenClient   │  (default)
│                     │                  └──────────────────────┘
│                     │◄─────────────────┤  HttpCodegenClient   │  (VITE_USE_BACKEND=1)
└─────────────────────┘                  └──────────────────────┘

┌─────────────────────┐    interface     ┌──────────────────────┐
│  PersistenceAdapter │◄─────────────────┤  MockAdapter         │  (default)
│                     │                  └──────────────────────┘
│                     │◄─────────────────┤  MockHttpAdapter     │  (alternate mock w/ latency)
│                     │                  └──────────────────────┘
│                     │◄─────────────────┤  HttpAdapter         │  (VITE_USE_BACKEND=1)
└─────────────────────┘                  └──────────────────────┘

┌─────────────────────┐    interface     ┌──────────────────────┐
│  RegistriesClient   │◄─────────────────┤  MockRegistriesClient│  (default)
│                     │                  └──────────────────────┘
│                     │◄─────────────────┤  HttpRegistriesClient│  (VITE_USE_BACKEND=1)
└─────────────────────┘                  └──────────────────────┘
```

Adding a new backend dependency? Make the seam first, then both clients.

---

## 6. What this does NOT do (resisting over-engineering)

1. **No JSON Schema served by the backend for the whole form.** Frontend keeps
   field descriptors. Backend serves data only.
2. **No WebSocket / SSE / event bus.** Polling is fine for the first 100 users.
3. **No write endpoints for code registries** (`LLM_CLIENT_REGISTRY`,
   `SEARCH_FILTER_REGISTRY`). Adding a new LLM client is a code change, not a
   config change.
4. **No pipeline builder UI.** Named pipelines from a dropdown only — when they
   exist.
5. **No client-side schema generation.** All `src/schemas/*.ts` stay
   hand-written. They consume registry data but the shape (fields, layout, help
   text) is hand-curated.
6. **No optimistic UI for config saves.** Save waits for backend confirmation;
   if Pydantic rejects, the UI shows the issues but doesn't roll back the
   working copy (user keeps their edits and fixes them).

---

## 7. Build order — concrete checklist

For **you (backend):**

1. ☐ Fix `api/routers/codegen.py:38` — `codegen_driver_agent` → `codegen_app`
2. ☐ Implement `GET /api/registries` — ~30 lines, pure introspection
3. ☐ Implement `GET /api/config/{file_id}` — reads TOML, returns parsed JSON
4. ☐ Implement `POST /api/config/{file_id}` — Pydantic validate + write
5. ☐ (Tier 1) `POST /api/config/{file_id}/validate` — same minus the write
6. ☐ (Tier 1) `POST /api/orchestrator/dry-run` — cross-file validation
7. ☐ (Tier 1) `GET /api/orchestrator/status` — for Dashboard

For **me (frontend, this session):**

1. ☑ Audit current frontend (done)
2. ☑ Write this contract doc (done)
3. ☐ Add `src/lib/registries/` seam (mock + http + context)
4. ☐ Add `src/lib/persistence/MockHttpAdapter.ts`
5. ☐ Add `src/lib/persistence/HttpAdapter.ts`
6. ☐ Wire `RegistriesProvider` into `main.tsx`
7. ☐ Refactor schemas to consume registry data
8. ☐ Update surfaces to use the new dynamic schemas
9. ☐ Run typecheck + tests + format

---

## 8. Glossary

| Term | Meaning here |
|---|---|
| **Registry (backend)** | A Python dict mapping name → class, e.g. `LLM_CLIENT_REGISTRY`. Code-derived. |
| **Registry (frontend)** | A `Map<id, Entry>` for plug-in style listings, e.g. `applicationRegistry`. UI-derived. |
| **Catalog data** | The enumerable values from backend registries that the UI exposes (LLM names, etc.). |
| **Schema descriptor** | Frontend-owned TypeScript object describing form fields. Lives in `src/schemas/*.ts`. |
| **Surface** | One editable slice of config (LLM Providers, Search Store, etc.). One file per surface in `src/modules/config/surfaces/`. |
| **Adapter** | Implementation of `PersistenceAdapter` — Mock or Http. |
| **Client** | Implementation of `CodegenClient` / `RegistriesClient` — Mock or Http. |
| **Seam** | A point where Mock and Http implementations of the same interface diverge. The single import switched by `VITE_USE_BACKEND`. |

---

## 9. Open questions (to revisit after Tier 0 ships)

1. **Should `provider` on `llm_clients[]` be derived backend-side or
   hardcoded in the endpoint?** Probably hardcoded in the endpoint to keep
   `LLMClientTemplate` clean. Revisit if a new provider class appears.
2. **Should `stub_categories` be in `/api/registries` or a separate
   `/api/stub-index/categories`?** Today putting it in registries is simpler.
   Move it out if registry response gets noisy.
3. **Should config edits be transactional across files?** Currently each file
   saves independently. A "save all" that's atomic across all 4 files would be
   useful; defer until users hit the multi-file-edit-then-save problem.
