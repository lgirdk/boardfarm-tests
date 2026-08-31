# Frontend Guide — Learn This Codebase From Zero

This document teaches you **everything** about the `frontend/` app: how React works, what
every tool and library is for, what every folder and file does, how the app boots and runs,
how data flows when you click something, and how to customize it. It assumes **no prior
React knowledge**.

Read it top-to-bottom the first time. After that, use the Table of Contents to jump around.

---

## Table of Contents

1. [The 60-second mental model](#1-the-60-second-mental-model)
2. [React from zero (the concepts you must know)](#2-react-from-zero)
3. [File types and what they mean](#3-file-types)
4. [The tooling (Vite, TypeScript, Tailwind, Vitest…)](#4-the-tooling)
5. [Every library in package.json and why it's here](#5-every-library)
6. [How the app boots — the startup chain](#6-how-the-app-boots)
7. [The folder structure, explained](#7-the-folder-structure)
8. [The four big ideas (architecture)](#8-the-four-big-ideas)
9. [End-to-end walkthrough: renaming an LLM field](#9-end-to-end-walkthrough)
10. [File-by-file reference](#10-file-by-file-reference)
11. [How to customize — worked examples](#11-how-to-customize)
12. [Running, testing, building](#12-running-testing-building)
13. [Glossary](#13-glossary)

---

## 1. The 60-second mental model

This app is a **website that runs entirely in your browser** (a "Single Page Application",
or SPA). There is no page reload when you navigate — JavaScript swaps what's on screen.

The whole UI is built from **components**. A component is just a **function that returns a
description of some UI**. The browser shows a tree of these components. When data changes,
the affected components re-run and the screen updates.

Today the app reads/writes config from an **in-memory mock** (no backend). The code is
structured so that swapping the mock for a real server later changes almost nothing.

```
Browser  ──loads──>  index.html  ──runs──>  main.tsx  ──renders──>  React component tree
                                                                     (AppShell, Sidebar, forms…)
```

---

## 2. React from zero

React is a JavaScript library for building user interfaces out of components. Here are the
concepts, each with an example from *this* codebase.

### 2.1 A component is a function that returns UI

```tsx
// src/modules/dashboard/DashboardApp.tsx (simplified)
export function DashboardApp() {
  return <h1>Dashboard</h1>;
}
```

- `export function DashboardApp()` — a normal JavaScript function. By convention component
  names are **PascalCase** (start with a capital letter). React requires this.
- It **returns** something that looks like HTML (`<h1>Dashboard</h1>`). That's **JSX** (next
  section).
- To "use" a component, you write it like a tag: `<DashboardApp />`.

### 2.2 JSX — HTML-looking syntax inside JavaScript

JSX is **not** HTML. It's a syntax that the build tool converts into function calls. When you
write:

```tsx
<h1 className="text-xl">Dashboard</h1>
```

the tool turns it into roughly `React.createElement("h1", { className: "text-xl" }, "Dashboard")`.
You never write that by hand — you just write the JSX. Key differences from HTML:

- `class` is written **`className`** (because `class` is a reserved word in JavaScript).
- You embed JavaScript with **curly braces**: `<h1>{title}</h1>` shows the value of `title`.
- Every JSX expression must have **one root element**. If you need siblings without a wrapper,
  use a "fragment": `<>...</>`.

### 2.3 Props — inputs to a component

Props are how a parent passes data **into** a child component. They're just the function's
arguments, packaged as one object.

```tsx
// src/components/Button.tsx (simplified)
export function Button({ variant, children }) {
  return <button className={variant}>{children}</button>;
}

// used elsewhere:
<Button variant="primary">Save</Button>
//        ^^^^^^^^^^^^^^^^  prop          ^^^^ children (the content between the tags)
```

- `{ variant, children }` is **destructuring** — pulling named fields out of the props object.
- `children` is a special prop: whatever you put *between* the opening and closing tags.
- Props flow **one way: down** (parent → child). A child cannot change its parent's data
  directly; instead the parent passes a **callback** prop (a function) the child can call.
  You'll see this everywhere as `onChange`, `onClick`, etc.

### 2.4 State — a component's memory (`useState`)

State is data a component remembers between renders. Changing it tells React to re-run the
component and update the screen.

```tsx
// src/app/AppShell.tsx
const [settingsOpen, setSettingsOpen] = useState(false);
```

- `useState(false)` creates a piece of state initialised to `false`.
- It returns a **pair**: the current value (`settingsOpen`) and a function to change it
  (`setSettingsOpen`).
- Calling `setSettingsOpen(true)` updates the value **and triggers a re-render**. You never
  assign `settingsOpen = true` directly — React wouldn't notice.

`useState` is a **Hook** (a function whose name starts with `use`). Hooks must be called at
the **top level** of a component (not inside `if`s or loops). That's a hard React rule.

### 2.5 Rendering and re-rendering

"Rendering" = React runs your component function to get the latest UI description, then
updates only the parts of the screen that changed. A component re-renders when:

- its **state** changes (via a `setX` function), or
- its **props** change (its parent passed new values), or
- its parent re-renders.

This is why bugs often come from "I changed a variable but the screen didn't update" — if it's
not state or a prop, React doesn't know to re-render. Use state.

### 2.6 Controlled inputs (the most important pattern here)

Every text box / dropdown / toggle in this app is **controlled**: React owns the value, and
the input reports changes via a callback. The pattern is always:

```tsx
<input
  value={value}                         // what to show (comes from state/props)
  onChange={(e) => onChange(e.target.value)}  // tell the owner the new value
/>
```

See [src/components/TextField.tsx](../src/components/TextField.tsx). The input never stores its
own value; the parent holds it in state and passes it back down. This is how the forms stay in
sync with the config data.

### 2.7 Effects — running code on load or when data changes (`useEffect`)

`useEffect` runs code **after** rendering — used for "side effects" like loading data.

```tsx
// src/modules/config/useConfigDoc.ts (simplified)
useEffect(() => {
  persistence.load(file).then((doc) => setWorking(doc)); // load config when mounted
}, [file]); // re-run only if `file` changes
```

- The function runs after the component appears on screen.
- The array at the end (`[file]`) is the **dependency list**: the effect re-runs only when
  those values change. `[]` means "run once on mount".

### 2.8 Lists and keys

To render a list, you `.map()` an array to JSX and give each item a stable `key`:

```tsx
{names.map((name) => (
  <button key={name}>{name}</button>
))}
```

The `key` helps React track items across re-renders. It must be unique and stable.

### 2.9 Conditional rendering

Show something only sometimes:

```tsx
{canAdd && <Button>Add</Button>}        // render Button only if canAdd is true
{loading ? <Spinner /> : <Content />}   // either/or
```

### 2.10 Custom Hooks — reusable stateful logic

A "custom hook" is a function starting with `use` that bundles state + effects so multiple
components can share the logic. This codebase has one big one:
[src/modules/config/useConfigDoc.ts](../src/modules/config/useConfigDoc.ts) — it loads a config
file, holds the editable copy, tracks "is it dirty", and saves. Any surface calls
`useConfigDoc("app")` and gets all that behaviour.

That's all the React you need to read this codebase.

---

## 3. File types

| Extension | What it is | Example here |
|---|---|---|
| `.ts` | **TypeScript** — JavaScript + type annotations. Logic with no UI. | `src/lib/registry.ts` |
| `.tsx` | TypeScript **+ JSX** — a file that contains UI (`<div>`…). | `src/components/Button.tsx` |
| `.css` | Stylesheet. | `src/index.css` |
| `.html` | The single HTML page the app loads into. | `index.html` |
| `.json` | Data/config (no logic). | `package.json`, `tsconfig.json` |
| `.md` | Markdown documentation (this file). | `README.md` |

**Rule of thumb:** if a file returns/contains JSX, it must be `.tsx`. Pure logic, types, and
data are `.ts`.

### What TypeScript adds (and why)

TypeScript is JavaScript with **types**. You annotate what shape data has, and the compiler
catches mistakes *before* you run the app.

```ts
function greet(name: string) { ... }   // name must be a string
greet(42);                             // ❌ compile error, caught instantly
```

We run the type-checker with `npm run typecheck` (it's `tsc --noEmit` — check types, emit no
output). Types are erased at build time; the browser runs plain JavaScript.

---

## 4. The tooling

### Vite — the dev server and bundler

[Vite](https://vitejs.dev) does two jobs:

1. **Dev server** (`npm run dev`): serves the app at `http://localhost:5173` with **HMR**
   (Hot Module Replacement) — edit a file, the browser updates instantly without a full reload.
2. **Build** (`npm run build`): bundles everything into static files in `dist/` for production.

Config: [vite.config.ts](../vite.config.ts). It registers the React plugin, sets the `@` path
alias (so `@/lib/...` means `src/lib/...`), and proxies `/api` to a future backend.

### npm, package.json, node_modules

- **npm** is the package manager (installs libraries).
- [package.json](../package.json) lists the project's **dependencies** and **scripts**.
- `node_modules/` is where installed libraries live (huge; never edited; git-ignored).
- **scripts** are shortcuts run with `npm run <name>`:
  - `dev` → start Vite dev server
  - `build` → typecheck + production build
  - `typecheck` → check types only
  - `test` → run unit tests once
  - `test:watch` → run tests, re-run on change

### TypeScript config — tsconfig.json

[tsconfig.json](../tsconfig.json) controls the type-checker. Notable settings:
- `"strict": true` — strongest type-safety.
- `"noUnusedLocals"/"noUnusedParameters"` — error on dead variables (keeps code clean).
- `"noUncheckedIndexedAccess"` — `array[0]` is typed `T | undefined`, forcing you to handle
  "might be missing". This is why you see `?? null` / `?? {}` in a few places.
- `"paths": { "@/*": ["src/*"] }` — the `@/` import alias.

### Tailwind CSS — styling via class names

Instead of writing separate `.css` rules, you style with **utility classes** in the markup:

```tsx
<div className="flex items-center gap-2 rounded-md border border-border p-4">
```

Each class is one CSS property: `flex` = `display:flex`, `p-4` = padding, `gap-2` = spacing
between children, etc. Our custom colors (`surface`, `border`, `muted`, `accent`) are defined
in [tailwind.config.ts](../tailwind.config.ts). [postcss.config.js](../postcss.config.js) is
the plumbing that runs Tailwind during the build. The base styles are in
[src/index.css](../src/index.css).

### Vitest — unit tests

[Vitest](https://vitest.dev) runs the `*.test.ts` files. Tests live **next to** the code they
test (e.g. `namedMap.ts` + `namedMap.test.ts`). We test the **logic** layer (validation,
registries, data transforms) because that's where silent bugs hide. Run with `npm run test`.

---

## 5. Every library

From [package.json](../package.json):

**Runtime dependencies** (shipped to the browser):

| Library | Why it's here |
|---|---|
| `react`, `react-dom` | React itself + the bit that renders into the browser DOM. |
| `react-router-dom` | Client-side routing (URL → which screen), without page reloads. |
| `@radix-ui/react-dialog` | Accessible modal/slide-over primitive (the settings panel, the save dialog). |
| `@radix-ui/react-select` | Accessible dropdown primitive (used by `SelectField`). |
| `@radix-ui/react-switch` | Accessible on/off toggle (used by `SwitchField`). |
| `lucide-react` | Icon set (the little SVG icons: gear, plus, trash, arrows…). |
| `zod` | Schema validation library — powers the **instant** inline form validation. |
| `smol-toml` | Parse/serialize TOML (so we can show a TOML diff and round-trip config). |
| `diff` | Computes the line-by-line before/after diff shown before saving. |

**Dev dependencies** (build/test only, not shipped):

| Library | Why |
|---|---|
| `vite`, `@vitejs/plugin-react` | Dev server + build + React support. |
| `typescript` | The type-checker / compiler. |
| `vitest`, `jsdom` | Test runner + a fake browser environment for tests. |
| `tailwindcss`, `postcss`, `autoprefixer` | Styling pipeline. |
| `@types/react`, `@types/react-dom`, `@types/diff` | Type definitions for libraries that ship plain JS. |

"Radix" primitives give us correct keyboard/focus/accessibility behaviour for free; we style
them with Tailwind. We never hand-roll a dropdown's a11y.

---

## 6. How the app boots

Follow the chain. Each step hands off to the next.

**Step 1 — `index.html`** ([index.html](../index.html)). The only HTML page. It contains an
empty `<div id="root"></div>` and loads the JavaScript entry point:

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

**Step 2 — `src/main.tsx`** ([main.tsx](../src/main.tsx)). The JavaScript entry point. It finds
that `#root` div and tells React to render the app into it:

```tsx
createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

- `createRoot(rootEl)` — "React, take over this DOM node."
- `RouterProvider router={router}` — "render whatever the router says for the current URL."
- `StrictMode` — a dev-only helper that surfaces bugs (it intentionally double-runs some code
  in development; harmless).

**Step 3 — `src/app/router.tsx`** ([router.tsx](../src/app/router.tsx)). Maps URLs to
components. It says: every URL renders `<AppShell>`, and inside it, `/app/:appId` renders
`<AppOutlet>` (the `:appId` part is a variable — `dashboard`, `config`, etc.).

**Step 4 — `src/app/AppShell.tsx`** ([AppShell.tsx](../src/app/AppShell.tsx)). The persistent
frame: the left `<Sidebar>`, the main content area (`<Outlet>` = "render the matched child
route here"), and `<SettingsHost>` (the slide-over). It holds one piece of state:
`settingsOpen`.

**Step 5 — content.** `<AppOutlet>` reads the `:appId` from the URL, looks it up in the
**application registry**, and renders that app's component. The Dashboard is the default.

So: `index.html → main.tsx → router → AppShell → (Sidebar + AppOutlet + SettingsHost)`.

---

## 7. The folder structure

```
frontend/
├── index.html              ← the single HTML page
├── package.json            ← dependencies + scripts
├── vite.config.ts          ← dev server / build config
├── tsconfig.json           ← TypeScript settings
├── tailwind.config.ts      ← design tokens (colors, fonts)
├── postcss.config.js       ← Tailwind plumbing
├── README.md               ← quick architecture overview
├── docs/
│   └── FRONTEND_GUIDE.md   ← this file
└── src/
    ├── main.tsx            ← JS entry point (boots React)
    ├── index.css           ← global styles + Tailwind import
    │
    ├── app/                ← THE SHELL (frame, nav, routing). Domain-agnostic.
    │   ├── registry.ts        application registry (the list of "apps")
    │   ├── AppShell.tsx       the frame: sidebar + content + settings host
    │   ├── Sidebar.tsx        left nav, built from the registry
    │   ├── AppOutlet.tsx      renders the active app based on the URL
    │   ├── SettingsHost.tsx   hosts the Config app in a slide-over
    │   └── router.tsx         URL → component map
    │
    ├── components/         ← GENERIC, reusable UI pieces. Know nothing about config.
    │   ├── Button.tsx, TextField.tsx, SelectField.tsx, SwitchField.tsx
    │   ├── SlideOver.tsx       right-side sliding panel (Radix Dialog)
    │   ├── ConfirmSaveDialog.tsx  centered modal showing the diff before save
    │   ├── DiffView.tsx        renders a colored +/- text diff
    │   ├── NamedCollection.tsx master/detail list with add/remove/rename
    │   ├── ReorderableList.tsx ordered list with up/down/remove
    │   ├── Field.tsx           label + help text + error wrapper for one field
    │   ├── FieldRenderer.tsx   picks the right control for a schema field
    │   ├── RecordForm.tsx      renders all fields of one record
    │   └── PolymorphicForm.tsx renders a "type-switching" record (encoders)
    │
    ├── lib/                ← LOGIC: no UI. Pure functions, types, helpers.
    │   ├── cn.ts              join CSS class strings
    │   ├── registry.ts       the generic Registry class
    │   ├── objectPath.ts      get/set a value at a dotted path in an object
    │   ├── namedMap.ts        add/rename/remove on a {name: value} map
    │   ├── toml.ts            parse/serialize TOML
    │   ├── persistence/       the read/write layer (the "adapter")
    │   │   ├── PersistenceAdapter.ts  the interface (the contract)
    │   │   ├── MockAdapter.ts         in-memory implementation (today)
    │   │   ├── seed.ts                the real config values, as data
    │   │   └── index.ts               picks which adapter is active
    │   └── schema/            the "schema as data" engine
    │       ├── types.ts          descriptor types (what a field can be)
    │       ├── toZod.ts          descriptor → zod validation + validateRecord()
    │       ├── crossRefs.ts      cross-file reference validation
    │       └── polymorphic.ts    helpers for type-switching records
    │
    ├── schemas/            ← DATA describing each config file's fields + help text.
    │   ├── app.schema.ts       app.toml ([llm.*])
    │   ├── store.schema.ts     store_config.toml (encoders, filters)
    │   ├── search.schema.ts    codegen/search.toml
    │   └── codegen.schema.ts   codegen/codegen.toml (stages, profiles)
    │
    └── modules/            ← FEATURES. One folder per area of the app.
        ├── dashboard/
        │   └── DashboardApp.tsx     placeholder home screen
        └── config/                  the "Settings" application
            ├── ConfigApp.tsx        sub-nav over the four config surfaces
            ├── useConfigDoc.ts      load/edit/dirty/save hook (the workhorse)
            ├── NamedCollectionEditor.tsx  generic collection editor
            ├── SaveBar.tsx          dirty indicator + diff-gated save button
            └── surfaces/            one folder per config file
                ├── registry.ts          the four surfaces + their folder groups
                ├── llm-providers/        app.toml editor
                ├── search-store/         store_config.toml editor
                ├── search-settings/      codegen/search.toml editor
                └── codegen-pipeline/     codegen/codegen.toml editor
```

**The mental split** (this is the whole philosophy):
- `app/` = the shell. Doesn't know what a config is.
- `components/` = generic widgets. Don't know what an LLM is.
- `lib/` = pure logic and the read/write seam.
- `schemas/` = **data** that describes each config file (fields, types, help text).
- `modules/` = the actual features, built by combining the above.

Lower layers never import higher ones. `components/` never imports `modules/`.

---

## 8. The four big ideas

### Idea 1 — The Registry pattern (pluggability)

Instead of hardcoding a list of screens, we **register** them into a `Registry`
([src/lib/registry.ts](../src/lib/registry.ts)). The same generic class powers two things:

- The shell's top-level apps ([src/app/registry.ts](../src/app/registry.ts)): Dashboard, Config.
- The Config app's four config surfaces
  ([src/modules/config/surfaces/registry.ts](../src/modules/config/surfaces/registry.ts)).

Adding a screen = adding one entry to a registry. The shell/sidebar/router never change. This
is why the app is described as "a platform" — future tools (log analyzer, debugger) plug in the
same way.

### Idea 2 — Schema as data (forms without copy-paste)

We do **not** write a custom form for each config file. Instead each config file is described
by **data**: a list of field descriptors (`schemas/*.ts`). A descriptor says "this field is a
string called `model`, required, with this help text". Generic components
(`FieldRenderer`, `RecordForm`) read the descriptors and render the right controls.

```ts
// from src/schemas/app.schema.ts — a field, as data
{ kind: "string", key: "model", label: "Model", required: true,
  description: "Model identifier passed to the provider, e.g. claude-sonnet-4-5." }
```

Adding a new field to a config = adding one such object. No new JSX.

### Idea 3 — The persistence seam (mock now, server later)

The UI never talks to a server or files directly. It talks to a `PersistenceAdapter`
**interface** ([src/lib/persistence/PersistenceAdapter.ts](../src/lib/persistence/PersistenceAdapter.ts))
with `load()` and `save()`. Today the active implementation is `MockAdapter` (in-memory,
seeded from the real config values). Later, an `HttpAdapter` that calls FastAPI drops in by
changing **one line** in [persistence/index.ts](../src/lib/persistence/index.ts). No UI code
changes.

### Idea 4 — Two kinds of validation (UX vs authority)

- **Instant UX validation** (this frontend, via `zod`): as you type, fields show inline errors
  ("Required", "Must be a valid URL"). Fast feedback. See
  [src/lib/schema/toZod.ts](../src/lib/schema/toZod.ts).
- **Authoritative validation** (the backend's Pydantic models, later): the *real* gate on save.
  The frontend zod is deliberately only for hints, so the two can't disagree in a dangerous way.

Plus **cross-file** checks ([crossRefs.ts](../src/lib/schema/crossRefs.ts)): e.g. a codegen
stage's `llm` must name an LLM that exists in `app.toml`.

---

## 9. End-to-end walkthrough

Let's trace **"I open Config → LLM Providers, and edit the `model` of `sonnet`."** This shows
exactly how the pieces connect.

1. **Open the panel.** You click the gear in [Sidebar.tsx](../src/app/Sidebar.tsx). It calls
   the `onOpenSettings` callback, which sets `settingsOpen = true` in
   [AppShell.tsx](../src/app/AppShell.tsx) (state change → re-render).

2. **The slide-over appears.** [SettingsHost.tsx](../src/app/SettingsHost.tsx) sees
   `open=true` and renders the Config app inside a [SlideOver.tsx](../src/components/SlideOver.tsx)
   (a Radix Dialog anchored to the right).

3. **Config sub-nav.** [ConfigApp.tsx](../src/modules/config/ConfigApp.tsx) reads the surface
   registry, groups the four surfaces by folder, and renders the nav. "LLM Providers" is
   selected by default → it mounts
   [LlmProvidersSurface.tsx](../src/modules/config/surfaces/llm-providers/LlmProvidersSurface.tsx).

4. **Load the data.** The surface calls `useConfigDoc("app")`
   ([useConfigDoc.ts](../src/modules/config/useConfigDoc.ts)). On mount, its `useEffect` calls
   `persistence.load("app")`. The active adapter is `MockAdapter`, which returns a copy of the
   seeded `app.toml` values ([seed.ts](../src/lib/persistence/seed.ts)). The hook stores two
   copies: `original` (untouched) and `working` (editable).

5. **Render the form.** The surface reads `working.llm` (the `{ sonnet: {...}, ... }` map) and
   hands it to [NamedCollectionEditor.tsx](../src/modules/config/NamedCollectionEditor.tsx)
   together with the **schema** `llmItemSchema` ([app.schema.ts](../src/schemas/app.schema.ts)).
   - The editor shows the list of LLM names on the left
     ([NamedCollection.tsx](../src/components/NamedCollection.tsx)).
   - For the selected one (`sonnet`), it renders the fields on the right via
     [RecordForm.tsx](../src/components/RecordForm.tsx), which loops the schema fields and uses
     [FieldRenderer.tsx](../src/components/FieldRenderer.tsx) to pick a control per field
     (`model` → a `TextField`).

6. **You type.** The `TextField`'s `onChange` fires with the new text. It bubbles up:
   `FieldRenderer → RecordForm → NamedCollectionEditor`'s `handleFieldChange` builds the new
   `llm` map and calls the surface's `onChange`, which calls
   `setWorking(setAtPath(working, "llm", nextMap))`
   ([objectPath.ts](../src/lib/objectPath.ts) does the immutable update). State changes →
   re-render → your new value shows.

7. **Validation runs.** On each render, the editor calls `validateRecord(schema.fields, record)`
   ([toZod.ts](../src/lib/schema/toZod.ts)) and passes any errors down so the field can show an
   inline message.

8. **Dirty tracking.** `useConfigDoc` serializes both `original` and `working` to TOML
   ([toml.ts](../src/lib/toml.ts)) and compares. They now differ → `dirty = true` → the
   [SaveBar.tsx](../src/modules/config/SaveBar.tsx) enables "Review & save".

9. **Save.** Clicking "Review & save" opens
   [ConfirmSaveDialog.tsx](../src/components/ConfirmSaveDialog.tsx), which shows
   [DiffView.tsx](../src/components/DiffView.tsx) — the exact `before → after` TOML. Confirm →
   `doc.save()` → `persistence.save("app", working)` → `MockAdapter` stores it, and `original`
   becomes `working` (no longer dirty).

Every config surface follows this exact shape. Once you understand this trace, you understand
the app.

---

## 10. File-by-file reference

### Root config files

- **index.html** — the single page; hosts `#root` and loads `main.tsx`.
- **package.json** — dependencies + npm scripts.
- **vite.config.ts** — Vite/Vitest config: React plugin, `@`→`src` alias, `/api` proxy, test
  setup (jsdom).
- **tsconfig.json / tsconfig.node.json** — TypeScript settings (strict; `@/` alias). The
  `.node` one is for tooling files like `vite.config.ts`.
- **tailwind.config.ts** — the design tokens (custom colors `surface/border/muted/accent`, mono
  font).
- **postcss.config.js** — runs Tailwind + autoprefixer.
- **README.md** — short architecture overview + status table.

### `src/` entry

- **main.tsx** — boots React into `#root` with the router.
- **index.css** — imports Tailwind layers; sets base body styles (dark theme).

### `src/app/` — the shell

- **registry.ts** — defines `Application` (`id, name, icon, kind, Component`) and registers
  Dashboard (`kind:"app"`) and Config (`kind:"settings"`). Helpers `listPrimaryApps()` /
  `listSettingsApps()`.
- **AppShell.tsx** — the frame; owns `settingsOpen` state.
- **Sidebar.tsx** — renders nav from the registry; the gear opens settings.
- **AppOutlet.tsx** — reads `:appId` from the URL, renders that app.
- **SettingsHost.tsx** — renders the settings-kind app inside a `SlideOver`.
- **router.tsx** — the URL map (`/` → redirect to `/app/dashboard`; `/app/:appId`).

### `src/components/` — generic widgets

- **Button.tsx** — styled button with `variant` (primary/secondary/ghost/danger) + `size`.
- **Field.tsx** — `FieldShell`: the label + help text + error wrapper every control uses; also
  exports the shared `inputClass` (input styling).
- **TextField.tsx** — labelled text input (controlled). Supports `readOnly`.
- **SelectField.tsx** — labelled dropdown built on Radix Select.
- **SwitchField.tsx** — labelled on/off toggle built on Radix Switch.
- **SlideOver.tsx** — right-anchored sliding panel (Radix Dialog). Contains the fix that keeps
  the panel open while a dropdown is open.
- **ConfirmSaveDialog.tsx** — centered modal that shows the diff and requires confirmation
  before saving.
- **DiffView.tsx** — renders the line diff (green `+`, red `-`) using the `diff` library.
- **NamedCollection.tsx** — the master/detail list control: a left list with add/remove/rename
  (those can be disabled), and a right detail area you supply.
- **ReorderableList.tsx** — an ordered list editor (move up/down, add, remove) for fields where
  order matters (`repo_priority_order`).
- **FieldRenderer.tsx** — given one field descriptor, renders the right control (string→TextField,
  bool→SwitchField, enum/ref→SelectField, list→ReorderableList or newline editor).
- **RecordForm.tsx** — renders **all** fields of one record by looping `FieldRenderer`.
- **PolymorphicForm.tsx** — renders a record whose fields depend on a "type" field (encoders):
  a type dropdown + the active variant's fields.

### `src/lib/` — logic (no UI)

- **cn.ts** — joins class-name strings, dropping falsy ones.
- **registry.ts** — the generic `Registry<T>` class (register/get/list, ordered, dup-checked).
- **objectPath.ts** — `getAtPath` / `setAtPath`: read/write a value at a dotted path
  (`"store.stub_registry"`) **immutably** (returns a new object; never mutates).
- **namedMap.ts** — pure operations on a `{name: value}` map: `addEntry`, `removeEntry`,
  `renameEntry` (preserves order), `uniqueName`, `validateKey`.
- **toml.ts** — `parseToml` / `serializeToml` wrapping `smol-toml`; strips `undefined`.
- **persistence/PersistenceAdapter.ts** — the **interface**: `load(file)`, `save(file, doc)`,
  plus the `ConfigFileId` type (`"app"|"store"|"search"|"codegen"`).
- **persistence/MockAdapter.ts** — in-memory implementation; clones the seed; "saves" to memory.
- **persistence/seed.ts** — the real values from the four TOML files, as JS objects.
- **persistence/index.ts** — exports `persistence` = the active adapter (today `MockAdapter`).
- **schema/types.ts** — the descriptor type system: `FieldDescriptor` (string/int/float/bool/
  enum/list/ref), `ObjectSchema`, `PolymorphicSchema`, `NamedCollectionSchema`, `ConfigSurface`.
  This is the vocabulary the whole "schema as data" idea speaks.
- **schema/toZod.ts** — turns a descriptor into a `zod` validator; `validateRecord(fields,
  record)` returns `{ fieldKey: errorMessage }`. Skips hidden (`visibleWhen`) and absent
  optional fields.
- **schema/crossRefs.ts** — `validateRef(value, target, …)`: checks a value exists in another
  file's collection (encoder→store, llm→app, profile→profiles).
- **schema/polymorphic.ts** — `activeFields`, `switchVariant` (prunes stale keys when the type
  changes), `validatePolymorphic`.

### `src/schemas/` — the descriptor data

- **app.schema.ts** — `llmItemSchema` (provider read-only, model, endpoint, api_key_env) and
  `llmProvidersSurface`.
- **store.schema.ts** — `storeRootSchema`, `stubRegistrySchema`, `encoderSchema` (polymorphic by
  `encoder_type`), `filtersSchema` (ordered `repo_priority_order` + `exclude_repos`).
- **search.schema.ts** — `encoderRefField` (cross-file), `strategySchema`, `defaultsSchema`,
  `fullCorpusSchema`, `subCorpusGroupSchema` (with the category list), `CATEGORY_OPTIONS`.
- **codegen.schema.ts** — `stageItemSchema` (llm + profile refs), `profileMetaSchema`,
  `stageSettingsSchema` (temperature/max_tokens), `newProfileRecord`.

### `src/modules/` — features

- **dashboard/DashboardApp.tsx** — placeholder home (a few static stat cards).
- **config/ConfigApp.tsx** — the Config app's grouped sub-nav (by folder) + mounts the selected
  surface.
- **config/useConfigDoc.ts** — the workhorse hook: load one file → `original`+`working`, track
  `dirty` (by comparing serialized TOML), `reset`, `save`.
- **config/NamedCollectionEditor.tsx** — generic editor for a `[table.<name>]` collection;
  handles object **or** polymorphic items; supports bounded mode and extra cross-field
  validation.
- **config/SaveBar.tsx** — sticky bar: dirty text, Reset, and "Review & save" (opens the diff
  dialog).
- **config/surfaces/registry.ts** — the four surfaces, each with `group` (folder) + `file`
  (display path) + `Component`; plus `groupedConfigSurfaces()`.
- **config/surfaces/llm-providers/LlmProvidersSurface.tsx** — app.toml `[llm.*]` editor
  (bounded: no add/rename/remove).
- **config/surfaces/search-store/SearchStoreSurface.tsx** — store_config.toml: Store / Encoders
  (polymorphic) / Filters (reorderable) tabs.
- **config/surfaces/search-settings/SearchSettingsSurface.tsx** — codegen/search.toml: encoder
  ref + strategy/defaults/full_corpus + sub-corpus groups (with the at-least-one-axis rule).
  Its `searchValidation.ts` holds that rule.
- **config/surfaces/codegen-pipeline/** — codegen/codegen.toml: `CodegenPipelineSurface` (Stages
  / Profiles tabs), `StagesEditor`, `ProfilesEditor`, `ProfileForm`, and `codegenValidation.ts`
  (the cross-ref + missing-sub-table rules).

### `*.test.ts` files

Unit tests for the logic layer (run with `npm run test`): `registry`, `objectPath`, `namedMap`,
`toml`, and `schema/{toZod, crossRefs, polymorphic}`, plus `searchValidation` and
`codegenValidation`. 41 tests total. They render **no UI** — they test pure functions, which is
where regressions are most dangerous.

---

## 11. How to customize

### Example A — Add a field to an existing config

Say `app.toml` LLM entries gain a `timeout` number. Open
[src/schemas/app.schema.ts](../src/schemas/app.schema.ts) and add one descriptor to
`llmItemSchema.fields`:

```ts
{ kind: "int", key: "timeout", label: "Timeout (s)", min: 1,
  description: "Request timeout in seconds." },
```

That's it. The form renders it, validates it, includes it in the diff, and saves it. **No
component changes.**

### Example B — Add a new config surface (new file/tab)

1. Create `src/schemas/myfile.schema.ts` with the field descriptors.
2. Create `src/modules/config/surfaces/my-surface/MySurface.tsx` (copy the smallest existing
   one — `LlmProvidersSurface.tsx` — and point it at your schema/file).
3. Register it in
   [src/modules/config/surfaces/registry.ts](../src/modules/config/surfaces/registry.ts) with a
   `group` (folder) + `file` + `Component`.
4. If it reads/writes a new file, add that file id to `ConfigFileId`
   ([PersistenceAdapter.ts](../src/lib/persistence/PersistenceAdapter.ts)) and seed it in
   [seed.ts](../src/lib/persistence/seed.ts).

The sub-nav, loading, dirty-tracking, diff, and save all work automatically.

### Example C — Add a brand-new top-level app (e.g. a Log Analyzer)

1. Create `src/modules/log-analyzer/LogAnalyzerApp.tsx` (any component).
2. Register it in [src/app/registry.ts](../src/app/registry.ts):
   ```ts
   { id: "logs", name: "Log Analyzer", icon: ScrollText, kind: "app",
     Component: LogAnalyzerApp }
   ```
It now appears in the sidebar and is reachable at `/app/logs`. The shell didn't change.

### Example D — Change colors / styling

Edit the tokens in [tailwind.config.ts](../tailwind.config.ts) (e.g. the `accent` color). Every
component using `bg-accent` / `text-accent` updates. For one-off tweaks, change the Tailwind
classes in that component's JSX.

### Example E — Switch from mock data to a real backend

Implement an `HttpAdapter` (same two methods as `PersistenceAdapter`) that `fetch()`es your
FastAPI, then change the one line in
[src/lib/persistence/index.ts](../src/lib/persistence/index.ts) to use it. No other file
changes.

---

## 12. Running, testing, building

> **Node 18+ required.** This machine's default `node` is an old Windows v16 on `/mnt/c`. Use
> the WSL Node 20 installed via nvm. Prefix commands with:
> `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`

```bash
cd frontend
npm install        # install dependencies (first time only)
npm run dev        # start the dev server → http://localhost:5173
npm run test       # run all unit tests once
npm run typecheck  # check types (no build)
npm run build      # typecheck + production build into dist/
```

- **Dev loop:** run `npm run dev`, edit a file, watch the browser update (HMR).
- **Before committing:** `npm run typecheck && npm run test` should both pass.

---

## 13. Glossary

- **Component** — a function returning UI (JSX). The unit everything is built from.
- **JSX** — HTML-looking syntax compiled to function calls; lives in `.tsx` files.
- **Prop** — an input passed from a parent component to a child.
- **State** — a component's remembered data; changing it re-renders (via `useState`).
- **Hook** — a `use*` function adding capabilities to a component (`useState`, `useEffect`, and
  our custom `useConfigDoc`). Must be called at the top level.
- **Render** — React running a component to produce the current UI.
- **Controlled input** — an input whose value lives in React state (`value` + `onChange`).
- **Effect** — code run after render for side effects like loading data (`useEffect`).
- **Registry** — a list you add entries to; the app reads it to know what screens exist.
- **Descriptor / schema-as-data** — a plain object describing a field, rendered generically.
- **Adapter** — an implementation of an interface; here, where config is read/written.
- **Dirty** — the working copy differs from what was loaded (there are unsaved changes).
- **HMR** — Hot Module Replacement; Vite updating the browser without a full reload.
- **TOML** — the config file format the orchestrator uses (`app.toml`, etc.).
- **Zod** — the library doing instant form validation in the browser.
- **Radix** — accessible UI primitives (dialog, select, switch) we style with Tailwind.
```
