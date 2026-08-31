# Orchestrator Platform UI

A frontend **platform shell** for the LLM codegen orchestrator. It's built to host
several tools over time (log analyzer, codegen runner, debugger, search playground).
**Configuration is just the first surface** — a secondary *settings* affordance, not the
headline app.

This is **chunk 1**: the shell + the registry seam + one fully-working config surface
(LLM Providers), proven end-to-end against an in-browser mock. No backend required yet.

## Requirements

> **Node 18+ is required** (Vite 5 / Vitest 2). The Windows Node on `/mnt/c` is v16 and
> will not work. Install a current Node inside WSL, e.g. `nvm install 20 && nvm use 20`.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run test       # schema/validation/registry unit tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

Open the app → **Dashboard** placeholder renders. Click the **Configuration** gear
(bottom of the left nav) → a slide-over opens with a 4-surface sub-nav. **LLM Providers**
is live: it shows the three real LLMs from `configs/app.toml`, supports add / remove /
rename, switches the `endpoint` field on for openai-compatible providers, and gates every
save behind a **TOML diff review**.

## Architecture (why it's shaped this way)

| Concern | Lives in | Note |
|---|---|---|
| The shell (frame, nav, routing) | `src/app/` | Renders entirely from a registry; owns nothing domain-specific. |
| The registry seam | `src/lib/registry.ts` | One generic mechanism, reused by the shell **and** the config sub-nav. |
| Generic form/UI primitives | `src/components/` | `FieldRenderer` is the only schema-kind → widget map. |
| Schema + validation + persistence | `src/lib/` | `schema/` (descriptors, zod, cross-refs), `persistence/` (adapter + mock), `toml.ts`. |
| Descriptor **data** per surface | `src/schemas/` | Field types + help text (from TOML comments). Adding a field = a data change. |
| Each config surface | `src/modules/config/` | Thin surface components over the generic editor. |

### Key decisions
- **Settings affordance, not a top-level app.** Config opens in a slide-over behind a gear.
  The same registry that places it could place a future Log Analyzer as a primary app.
- **Persistence is an interface (`PersistenceAdapter`).** Today: `MockAdapter`, seeded from
  the real `configs/*.toml`. Later: an `HttpAdapter` hitting the existing FastAPI, which
  imports the real Pydantic models. Swapping adapters changes **no UI code**.
- **Validation has one authoritative source.** Zod here is UX-only (instant inline hints);
  Pydantic stays the gate of record on real save — so the two never drift.
- **Schema as data.** `src/schemas/*.ts` describe fields declaratively; generic components
  render them. New field → new descriptor entry. New file → new descriptor module + a thin
  surface. Generic components don't change.

### Where reality differed from the original brief
- The orchestrator hardcodes exactly three pipeline stages (`reasoning`/`search`/
  `generation`); the schema sources the stage list from that truth rather than pretending
  it's open-ended.
- `[filters]` is a fixed pair (`repo_priority_order`, `exclude_repos`), not a dynamic
  registry.
- The encoder cross-file reference (search → store encoders) is **not** validated at load
  time today, so the UI/backend adds it. The other two refs are already Pydantic-enforced.

## Status

All four config surfaces are implemented against the in-browser MockAdapter:

| Folder | Surface | Highlights |
|---|---|---|
| `app.toml` | **LLM Providers** | Bounded (registry-backed); `provider` read-only; params only. |
| `search_store/` | **Store Config** | Polymorphic encoders (`encoder_type`), reorderable `repo_priority_order`. |
| `codegen/` | **Pipeline** | Stage→LLM/profile cross-refs (#2,#3) + missing-sub-table rule; per-stage settings. |
| `codegen/` | **Search** | Encoder cross-ref (#1); sub-corpus groups with the at-least-one-axis rule. |

## Roadmap (remaining)
- **Backend (the planned chunk 5):** see `docs/BACKEND_API_CONTRACT.md` for the
  full endpoint specification. Three Tier-0 endpoints unblock the dynamic UI:
  `GET /api/registries`, `GET /api/config/{file}`, `POST /api/config/{file}`.
  Tier-1 adds dedicated validate + status endpoints.
  Diff-before-write on the server path; seam for git-backed snapshots on save.
- **Nice-to-haves:** constrained multi-select chips for enum lists (categories),
  duplicate-as-template for sub-corpus groups.

## Dynamic data (registries)

The UI no longer hardcodes LLM names, encoder types, stage names, prompt
variants, etc. It fetches them from the backend's `GET /api/registries`
endpoint via `src/lib/registries/`. Until the backend lands, a
`MockRegistriesClient` returns canned data that mirrors what the real backend
would produce — so the UI is fully usable without a backend.

Flip `VITE_USE_BACKEND=1` (e.g. in `.env.local`) to swap mocks for HTTP across
the codegen client, persistence adapter, and registries client in one step.
