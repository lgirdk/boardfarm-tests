# Frontend Architecture — Developer Guide

> How the frontend is structured, where mock data lives, and how to swap it for
> real APIs. Written so a new developer can integrate real backends without
> reading every file first.

---

## 1. The seam pattern (Mock / Http / toggle)

Every data domain follows the same three-file structure:

```
lib/<domain>/
  <Domain>Client.ts      ← TypeScript interface (the contract)
  Mock<Domain>Client.ts   ← In-memory implementation using seed data
  Http<Domain>Client.ts   ← fetch() stubs pointing at the real API
  seed.ts                 ← Hardcoded mock data (only loaded in mock mode)
  index.ts                ← Instantiates one or the other based on the toggle
```

### The toggle

In each `index.ts`:

```ts
const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

export const fooClient: FooClient = useBackend
  ? new HttpFooClient()
  : new MockFooClient();
```

Set `VITE_USE_BACKEND=1` in your `.env` (or pass it to `vite`) to switch **all**
domains from mock to real API mode at once. With the flag unset (the default),
the frontend runs entirely standalone with mock data — no backend needed.

### Domains that have this pattern

| Domain | Interface | Mock | Http | Seed |
|---|---|---|---|---|
| runs | `RunsClient` | ✅ | ✅ | `runs/seed.ts` |
| tests | `TestsClient` | ✅ | ✅ | `tests/seed.ts` |
| apps (codegen, jira) | `AppsClient` | ✅ | ✅ | inline in mock |
| auth | `AuthClient` | ✅ | ✅ | inline in mock |
| workflows | `WorkflowsClient` | ✅ | ✅ | `workflows/seed.ts` |
| registries | `RegistriesClient` | ✅ | ✅ | `registries/seed.ts` |
| persistence | `PersistenceClient` | ✅ | ✅ | `persistence/seed.ts` |
| environments | `EnvironmentsClient` | ✅ | ✅ (stub) | `environments/seed.ts` |
| beds | `BedsClient` | ✅ | ✅ (stub) | `beds/seed.ts` |
| suites | `SuitesClient` | ✅ | ✅ (stub) | `suites/seed.ts` |
| schedules | `SchedulesClient` | ✅ | ✅ (stub) | `schedules/seed.ts` |
| analyzer | `AnalyzerClient` | ✅ | ✅ (stub) | `analyzer/seed.ts` |
| activity | `ActivityClient` | ✅ | ✅ (stub) | `activity/seed.ts` |

"✅ (stub)" means the Http client class exists with the correct fetch calls, but
hasn't been tested against a real backend yet. The endpoints follow the contract
in `docs/BACKEND_API_CONTRACT.md`.

---

## 2. How to integrate a real API for a domain

Example: wiring `beds` to a real backend.

1. **Check the interface** — read `lib/beds/BedsClient.ts` to see what methods
   you need to implement (`list()`, `availability()`).

2. **Check the Http stub** — `lib/beds/HttpBedsClient.ts` already has the fetch
   calls. Verify the endpoint paths match your backend routes. Adjust if needed.

3. **Set the toggle** — add `VITE_USE_BACKEND=1` to your `.env`. This switches
   *all* domains. If you only want to switch one domain, you can change that
   domain's `index.ts` to always use Http (or add a per-domain env var).

4. **Test** — the component code (`modules/`) doesn't change at all. It calls
   `bedsClient.list()` regardless of which implementation backs it.

### If you prefer a different approach

The toggle via `VITE_USE_BACKEND` is one convention — you're not locked into it.
The important architectural guarantee is:

> **Components never import seed data or mock logic directly.** They only call
> methods on the client singleton exported from each domain's `index.ts`.

So you can replace the toggle mechanism with anything (runtime config, feature
flags, a DI container) as long as you swap at the `index.ts` level. The
components, the Mock clients, and the Http clients remain untouched.

---

## 3. Where the mock data lives

Every `seed.ts` file has a provenance header comment explaining what it seeds.
To find all mock data:

```bash
find src/lib -name 'seed.ts'
```

Additionally:
- `lib/runs/runArtifactsSeed.ts` — mock pcap/log/serial artifacts
- `lib/runs/transcript.ts` — reconstructs console output from run steps (mock only)
- `lib/activity/seed.ts` — dashboard team activity entries

**No module under `src/modules/` imports seed files.** Verified. This means
removing or changing mock data never requires touching component code.

---

## 4. Contracts

All shared TypeScript types live in `lib/contracts/index.ts`. This is the single
source of truth for response shapes. Both Mock and Http clients return these
types, so the contract is enforced at compile time.

When adding a new API, define the response type in contracts first, then
implement the client interface.

---

## 5. Project structure (quick reference)

```
src/
  app/           ← Shell: router, sidebar, login
  components/    ← Shared UI primitives (Button, StatusChip, CodeView, …)
  lib/           ← Data layer: one folder per domain (the seam pattern above)
    contracts/   ← All shared TypeScript types
    runs/        ← RunsClient + engine + seed + transcript
    tests/       ← TestsClient + seed
    ...          ← (one folder per domain)
  modules/       ← Feature pages (dashboard, library, runs, codegen, analyzer, …)
```

### Key conventions

- **`lib/`** = data + logic. No React here (except hooks in `lib/*/use*.ts`).
- **`modules/`** = pages and feature UI. They consume `lib/` clients via imports.
- **`components/`** = reusable, domain-agnostic UI atoms.
- **Pure compute** (test health scoring, requirement resolution, TOML parsing)
  lives in `lib/` as standalone functions — these are legitimately client-side
  and don't need a mock/http seam.

---

## 6. Running locally

```bash
npm install
npm run dev          # starts Vite on port 5173, mock mode (no backend needed)
npx tsc --noEmit     # typecheck
npm run build        # production build
```

To run against a real backend:

```bash
VITE_USE_BACKEND=1 npm run dev
```
