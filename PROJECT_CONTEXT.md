# Project Context — test-automation-engine

This document gives a new session everything it needs to understand the codebase, the architecture, the design decisions already made, and the current state of work. It is descriptive, not instructive.

---

## 1. What this project is

An **AI-powered test automation engine**. Given a structured test specification (test name, steps, preconditions), it generates runnable pytest code using:

1. **Reasoning** — an LLM analyzes the test spec and produces an implementation plan
2. **Searching** — a multi-round search agent finds relevant framework APIs from a pre-indexed stub registry (using BM25 keyword search + FAISS semantic search)
3. **Code generation** — an LLM produces the final pytest code using the retrieved API context

The engine is **framework-agnostic**. Today it targets a specific test framework called "boardfarm" (for cable modem/router testing), but the architecture is designed so any framework can be onboarded by:
- Providing a stub index (structured JSON of the framework's API surface)
- Registering domain-specific prompts, hooks, and rules via a `CodegenDomainSetup` object
- Pointing to the domain setup via a config entrypoint string

The system exposes itself via a **FastAPI HTTP interface** and has a **React frontend** (in early stages) for configuration editing and code generation.

---

## 2. Repository structure

```
claude_test/
├── configs/                        # TOML configuration files (deployment-specific)
│   ├── app.toml                    # Root config: LLM definitions, paths to sub-configs
│   ├── codegen/
│   │   ├── codegen.toml            # Pipeline stages, profiles, LLM assignments
│   │   └── search.toml             # Search tuning: corpora, thresholds, strategy
│   └── search_store/
│       └── store_config.toml       # Encoder config, filter config, artifact paths
│
├── src/                            # Backend Python source
│   ├── orchestrator.py             # Wiring diagram: builds shared services + apps
│   ├── codegen/                    # The codegen "app"
│   │   ├── codegen_app.py          # App entry point (build + generate)
│   │   ├── driver_agent.py         # Pipeline orchestration (reasoning → search → generate)
│   │   ├── searcher_agent.py       # Multi-round LLM-guided search
│   │   ├── reasoning.py            # Reasoning stage
│   │   ├── code_generator.py       # Generation stage
│   │   ├── context_assembler.py    # Assembles search results into LLM context
│   │   ├── data_models.py          # All dataclasses + pydantic models + domain setup
│   │   ├── config_schema.py        # Pydantic config schemas for codegen.toml + search.toml
│   │   ├── enums.py                # StrEnums: stages, variants, output types
│   │   ├── protocols.py            # Hook protocols (ForceIncludeEntryHook, etc.)
│   │   ├── exceptions.py           # Domain exceptions
│   │   ├── schemas/                # JSON schemas for search agent LLM output validation
│   │   └── prompt/                 # Prompt templates organized by variant × stage × output type
│   │       └── pytest/
│   │           ├── standard_variant/
│   │           └── compact_variant/
│   ├── search_store/               # Search infrastructure
│   │   ├── service.py              # SearchStoreService (public surface, owns engine factory)
│   │   ├── search_engine.py        # StubCodeSearchEngine (hybrid BM25 + FAISS)
│   │   ├── bm25_search.py          # BM25Okapi/Plus wrapper with custom tokenizer
│   │   ├── faiss_embeddings.py     # FAISS index manager with checksum integrity
│   │   ├── encoders.py             # SentenceTransformer, OpenAI, CrossEncoder wrappers
│   │   ├── utils.py                # StubCodeRegistry (builds + loads the search corpus)
│   │   ├── filters.py              # CorpusHits filters (RepoPriorityFilter, RepoExcludeFilter)
│   │   ├── selectors.py            # Sub-corpus selector functions
│   │   ├── config_schema.py        # Pydantic config for store_config.toml
│   │   ├── data_models.py          # ParsedKey, SearchPairs, ResolvedIndexStubEntry, etc.
│   │   ├── custome_types.py        # TypedDicts for the stub index structure
│   │   └── enum_types.py           # MemberType enum
│   ├── llm/                        # LLM client abstraction layer
│   │   ├── __init__.py             # Exports + module-level LLM_CLIENT_REGISTRY singleton
│   │   ├── registry.py             # LLMClientRegistry (singleton via metaclass) + LLMPool
│   │   ├── llm_pool.py             # LLMPool: lazy-built, cached LLM client instances
│   │   ├── templates.py            # LLMClientTemplate ABC (call, from_config, etc.)
│   │   ├── anthropic.py            # AnthropicClient
│   │   ├── openai_llm.py           # OpenAIClient
│   │   ├── custome_openi_gpt4o_client.py  # Custom OpenAI-compatible HTTP client
│   │   ├── config_schema.py        # LLMConfig pydantic model
│   │   └── data_containers.py      # LLMCallSettings, ToolDefinition
│   └── env_generator/              # (work in progress, not active)
│
├── api/                            # FastAPI HTTP layer
│   ├── app.py                      # App factory, lifespan (builds Orchestrator at startup)
│   ├── dependencies.py             # get_orchestrator dependency
│   ├── routers/
│   │   └── codegen.py              # POST /boardfarm/generate endpoint
│   └── schemas/
│       └── codegen.py              # Response schemas
│
├── frontend/                       # React + TypeScript + Vite + Tailwind UI
│   ├── src/
│   │   ├── app/                    # Shell, sidebar, routing, app registry
│   │   ├── components/             # Generic form primitives (FieldRenderer, RecordForm, etc.)
│   │   ├── lib/
│   │   │   ├── persistence/        # PersistenceAdapter seam (MockAdapter, HttpAdapter)
│   │   │   ├── registries/         # RegistriesClient seam (Mock/Http + React context)
│   │   │   ├── schema/             # Schema-as-data types, Zod validation, cross-file refs
│   │   │   └── run/                # useRun hook for async operations
│   │   ├── modules/
│   │   │   ├── codegen/            # Codegen tab (step editor → generate → result panel)
│   │   │   ├── config/             # Configuration slide-over with 4 surfaces
│   │   │   │   └── surfaces/
│   │   │   │       ├── llm-providers/
│   │   │   │       ├── search-store/
│   │   │   │       ├── codegen-pipeline/
│   │   │   │       └── search-settings/
│   │   │   └── dashboard/          # Placeholder dashboard with registry-driven stats
│   │   └── schemas/                # Field descriptors per config file
│   └── docs/
│       ├── FRONTEND_GUIDE.md       # Full frontend architecture guide
│       └── BACKEND_API_CONTRACT.md # API endpoint contract for frontend-backend integration
│
├── tests/                          # Pytest test suite (356 tests)
│   ├── conftest.py                 # Shared fixtures
│   ├── test_orchestrator.py
│   ├── codegen/                    # Tests for every codegen module
│   ├── llm/                        # Tests for every LLM client (all mocked)
│   └── search_store/               # Tests for registry, search, encoders, filters
│
├── domain/                         # Framework-specific domain setups
│   └── boardfarm/                  # boardfarm domain (prompts, hooks, knowledge)
│
├── artifacts/                      # Generated artifacts (FAISS indexes, stub registries)
│   └── stubs_index.json            # The stub index (structured API documentation)
│
└── pyproject.toml                  # Python 3.14, ruff, mypy config
```

---

## 3. Architecture — the layers

```
┌──────────────────────────────────────────────────────────────┐
│  Entry points                                                │
│  ├─ api/routers/codegen.py     (FastAPI HTTP)                │
│  ├─ main.py / CLI              (direct invocation)           │
│  └─ frontend/                  (React UI)                    │
└────────┬─────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Orchestrator (src/orchestrator.py)                          │
│  THE WIRING DIAGRAM — builds and holds everything.           │
│                                                              │
│  Shared services:                                            │
│  ├─ self.llm_pool          (LLMPool — lazy client cache)     │
│  ├─ self.search_store_service  (SearchStoreService)          │
│                                                              │
│  Apps:                                                       │
│  ├─ self.codegen_app       (CodegenApp)                      │
│  ├─ (future) self.log_analyzer_app                           │
│  ├─ (future) self.env_generator_app                          │
│                                                              │
│  Pipelines (future — methods on orchestrator):               │
│  ├─ self.triage_and_fix(...)                                 │
│  └─ self.coverage_sweep(...)                                 │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Apps (business logic)                                       │
│  ├─ src/codegen/         CodegenApp.build() → .generate()    │
│  │     Pipeline: reasoning → search → context assembly →     │
│  │                code generation                            │
│  ├─ (future) src/log_analyzer/                               │
│  └─ (future) src/env_generator/                              │
│                                                              │
│  Each app:                                                   │
│  • owns its config schema (Pydantic models)                  │
│  • owns its build() classmethod (wiring from config)         │
│  • receives shared services (search_store, llm_pool)         │
│  • exposes a clean public surface (generate, analyze, etc.)  │
└──────────┬───────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Infrastructure (shared tools)                               │
│  ├─ src/llm/         LLM clients + registry + pool           │
│  ├─ src/search_store/ FAISS + BM25 + stub registry + filters │
│  └─ (future) persistence, metrics, job queue                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. The codegen pipeline in detail

When `CodegenApp.generate(input_, output_task_type)` is called:

```
CodegenTestInput (name, steps, description, preconditions)
       │
       ▼
1. REASONING — LLM analyzes the test spec
   • Prompt: system (domain_knowledge) + user (input_text)
   • Output: analysis string (implementation plan)
       │
       ▼
2. FORCE-INCLUDE HOOKS — domain callbacks inject required entries
   • e.g., "always include all fixtures for boardfarm"
   • Returns: set of pre-selected corpus indices
       │
       ▼
3. SEARCH — multi-round LLM-guided search
   • Round 0: LLM decomposes the task into nouns + semantic queries
   • Round 1..N (keep style): search → show results → LLM picks which to keep
   • Round 1..M (remove style): search → show results → LLM picks which to remove
   • Each round: hybrid search (BM25 for nouns, FAISS for queries)
   •             across full corpus + sub-corpora (per search.toml config)
   • Output: set of selected corpus indices
       │
       ▼
4. POST-SEARCH HOOKS — domain callbacks add companion entries
   • e.g., "if WAN is selected, also include LAN"
       │
       ▼
5. CONTEXT ASSEMBLY — consolidate + format for LLM
   • Resolve indices → ResolvedIndexStubEntry objects
   • Group by category, format as structured text
   • Collect import paths
       │
       ▼
6. CODE GENERATION — LLM produces the final code
   • Prompt: system (analysis, retrieved_entries, framework_rules, example_test)
   •         user (input_text, domain_knowledge)
   • Output: generated pytest code string
```

---

## 5. Key data flow: the stub index

The stub index (`artifacts/stubs_index.json`) is a **structured documentation of a framework's API surface**. It's the knowledge base the search engine queries against.

Structure:
```json
{
  "use_cases": [
    {
      "type": "function",
      "name": "http_get",
      "import": "from boardfarm.use_cases.networking import http_get",
      "file": "boardfarm/use_cases/networking.py",
      "signature": "(device, url, timeout=30) -> str",
      "docstring": "Perform HTTP GET from a device.",
      "hints": ["network", "http"],
      "tags": ["networking"]
    }
  ],
  "templates": [
    {
      "type": "class",
      "name": "WAN",
      "import": "from boardfarm.templates.wan import WAN",
      "file": "boardfarm/templates/wan.py",
      "docstring": "WAN client device.",
      "methods": [{"name": "get_eth_interface_ipv4_address", "...": "..."}],
      "properties": [{"name": "ip_address", "...": "..."}]
    }
  ]
}
```

At startup, `StubCodeRegistry` parses this into:
- `search_corpus` (parallel lists: `documents[i]` = searchable text, `keys[i]` = unique hierarchical key)
- `index_registry` (dict: key → full entry including methods/properties)
- `module_corpus` (module-level search)
- Sub-corpora (filtered views per category/repo)

The search engine builds both BM25 (tokenized keyword index) and FAISS (vector embedding index) over these corpora.

---

## 6. LLM abstraction

```
LLMClientTemplate (ABC)
├── AnthropicClient         (Anthropic SDK)
├── OpenAIClient            (OpenAI SDK)
└── CustomeOpenAIGPT4oClient (raw httpx to any OpenAI-compatible endpoint)

LLMClientRegistry (singleton via RegistrySingleton metaclass)
├── Maps name → class: {"sonnet": AnthropicClient, "custome_gpt4o": CustomeOpenAIGPT4oClient, ...}
├── Auto-registers in src/orchestrator.py at import time
└── Validates uniqueness, supports override

LLMPool
├── Takes dict[str, LLMConfig] from app.toml [llm.*]
├── Lazy builds: first call to pool.get("sonnet") instantiates the client
├── Caches: second call returns the same instance
└── Apps call pool.get(name) instead of building clients directly
```

---

## 7. Configuration system

**Root config:** `configs/app.toml` — the manifest. Contains:
- `[llm.*]` — LLM client configurations (model, endpoint, api_key_env)
- `[search_store]` — path to the search store config file
- `[codegen]` — paths to codegen's config files

**Sub-configs** (referenced by paths in app.toml):
- `configs/codegen/codegen.toml` — pipeline stages (which LLM + profile per stage), profile definitions (temperature, max_tokens per stage)
- `configs/codegen/search.toml` — search strategy (keep/remove rounds), BM25/FAISS thresholds, sub-corpus group definitions
- `configs/search_store/store_config.toml` — encoder definitions (sentence-transformer or OpenAI), filters, artifact paths

**All configs are validated by Pydantic models** at load time. Cross-file references (stage.llm → app.toml LLM, search.encoder → store encoders) are checked.

**Domain setup** is loaded via an entrypoint string (`"domain.boardfarm.domain_setup:codegen_setup"`) that the codegen app imports and validates as a `CodegenDomainSetup` instance. This provides framework-specific prompts, hooks, and knowledge.

---

## 8. Frontend architecture

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Radix UI + Zod

**Key pattern — the seam:** Every external dependency has a mock + HTTP implementation, toggled by `VITE_USE_BACKEND=1`:

| Seam | Mock (default) | HTTP (with backend) |
|---|---|---|
| Config persistence | `MockAdapter` (in-memory) | `HttpAdapter` (GET/POST /api/config/{file_id}) |
| Codegen execution | `MockCodegenClient` (canned pytest) | `HttpCodegenClient` (POST /boardfarm/generate) |
| Backend registries | `MockRegistriesClient` (seeded catalog) | `HttpRegistriesClient` (GET /api/registries) |

**Current UI tabs:**
- **Dashboard** — stat tiles from backend registries (LLM count, stage count, encoder types)
- **Codegen** — structured test spec editor → generate button → result panel with code
- **⚙ Configuration** (slide-over) — 4 surfaces editing the TOML config files:
  - LLM Providers (app.toml [llm.*])
  - Store Config (store_config.toml — encoders, filters, paths)
  - Pipeline (codegen.toml — stages, profiles)
  - Search (search.toml — strategy, thresholds, sub-corpus groups)

**Schema-as-data:** Field descriptors in `src/schemas/*.ts` declare form fields declaratively. Generic components (`FieldRenderer`, `RecordForm`, `NamedCollectionEditor`, `PolymorphicForm`) render any descriptor. Adding a config field = adding a descriptor entry, not writing JSX.

**Dynamic data from backend:** The frontend no longer hardcodes LLM names, encoder types, stage names, prompt variants, filter names, or stub categories. These come from `useRegistries()` (React context backed by the registries client). Schema descriptor factories (`makeProfileMetaSchema(registries)`, `makeSubCorpusGroupSchema(registries)`) consume this data to build enum options at runtime.

---

## 9. Design decisions already made

### Orchestrator role
- The orchestrator is the **wiring diagram** — builds shared services, builds apps, holds references. It does NOT contain business logic.
- Apps own their config schemas, their `build()` methods, their internal wiring. The orchestrator calls `App.build(config, **services)` and stores the result.
- Pipelines (cross-app workflows) will be **methods on the orchestrator**, hand-wired by the developer. Not a dict-of-apps registry, not a visual DAG editor.
- Single-app operations go directly to the app (`orc.codegen_app.generate(...)`) — the orchestrator does NOT proxy them.

### Separation of concerns
- **Config I/O** (reading/writing TOML files) belongs in a dedicated `ConfigFileService`, not in apps or orchestrator.
- **Schema** (Pydantic models) belongs in each app's code.
- **File path mapping** (`file_id → Path`) is derived from `AppConfig` — the orchestrator exposes it as a property, the config service consumes it.
- **Frontend never sees file paths** — it uses logical IDs (`"app"`, `"store"`, `"codegen"`, `"search"`).

### LLM registry
- `LLMClientRegistry` is a singleton (metaclass-enforced) that maps name → class.
- `LLMPool` is a lazy instance cache that wraps the registry + config.
- Registrations happen at orchestrator import time with `override=True`.

### Search store
- `SearchStoreService` owns the registry, filters, and engine factory.
- Codegen tells search_store WHAT it needs (encoder name, sub-corpus selectors).
- Search_store knows HOW to build it (registry, FAISS, BM25, filters).

### Frontend data split
- **Catalog data** (LLM names, encoder types, stage names) → from backend via `/api/registries`
- **Field descriptors** (labels, help text, layout, validation hints) → frontend-owned
- **Authoritative validation** → Pydantic (backend) is the gate; Zod (frontend) is UX-only
- **TOML content** → read/written via `/api/config/{file_id}`

### Config lifecycle
- Phase 1 (current): save to disk, show "restart to apply" banner
- Phase 2 (planned): `POST /api/orchestrator/reload` selectively rebuilds affected services/apps
- Apps are immutable instances — reload = build new instance, swap reference, GC old one

---

## 10. Test suite

**356 tests, all passing, ~12s runtime.** No real LLM calls, no network I/O.

- Every LLM client test mocks the SDK (`patch("src.llm.anthropic.Anthropic")`, etc.)
- Every search engine test mocks BM25 + FAISS constructors
- `StubCodeRegistry` tests use real JSON files in `tmp_path`
- Orchestrator test mocks `SearchStoreService.from_toml` and `CodegenApp.build`
- Frontend has 51 Vitest tests (schema validation, registry, TOML serialization, codegen input)

---

## 11. Current state and immediate next steps

### Done
- ✅ Orchestrator refactored (clean app/service separation)
- ✅ LLM registry + pool implemented
- ✅ SearchStoreService extracted
- ✅ CodegenApp.build() owns all codegen wiring
- ✅ Frontend made dynamic (registries context, mock/http seams)
- ✅ Backend API contract documented (`BACKEND_API_CONTRACT.md`)
- ✅ Test suite covers all modules (356 backend + 51 frontend tests)

### Needs doing
- ☐ Fix `api/routers/codegen.py:38` — `codegen_driver_agent` → `codegen_app.generate(...)`
- ☐ Move `domain_setup_entrypoint` from `app.toml [codegen]` into `codegen.toml`
- ☐ Build backend endpoints: `GET /api/registries`, `GET/POST /api/config/{file_id}`
- ☐ Build `ConfigFileService` for config I/O
- ☐ Add orchestrator's `config_file_map` property (derives file_id → path from AppConfig)
- ☐ Build default config template generator (static templates validated against Pydantic, or dict-based defaults)
- ☐ Add `POST /api/orchestrator/reload` for selective rebuild
- ☐ Update orchestrator tests for new config service
- ☐ Wire frontend `VITE_USE_BACKEND=1` end-to-end

### Future
- ☐ First cross-app pipeline (e.g., triage-and-fix: log_analyzer → codegen)
- ☐ Pipeline tab in UI (card grid with auto-generated forms)
- ☐ Async job queue for long-running generations
- ☐ `GET /api/orchestrator/status` for Dashboard

---

## 12. How to run

```bash
# Backend
cd /home/ahazra/workspace/claude_test
.venv/bin/uvicorn api.app:app --host 0.0.0.0 --port 8080

# Frontend (mock mode, no backend needed)
cd frontend && npm install && npm run dev
# → http://localhost:5173

# Frontend (real backend)
VITE_USE_BACKEND=1 npm run dev

# Tests
.venv/bin/python -m pytest tests/ -q          # 356 pass
cd frontend && npm run test                    # 51 pass
cd frontend && npm run typecheck               # 0 errors
```

---

## 13. Key files to read first (in order)

1. `src/orchestrator.py` — the wiring diagram (short, 114 lines)
2. `src/codegen/codegen_app.py` — how an app builds itself (136 lines)
3. `src/codegen/driver_agent.py:235-277` — the `generate()` pipeline
4. `src/search_store/service.py` — search store public surface
5. `src/llm/registry.py` — LLM client registry + singleton
6. `configs/app.toml` — the root config manifest
7. `frontend/docs/BACKEND_API_CONTRACT.md` — what the UI expects from the backend
8. `frontend/src/lib/registries/RegistriesClient.ts` — the registries contract
9. `tests/test_orchestrator.py` — how the orchestrator is tested
