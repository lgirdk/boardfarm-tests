# Frontend Commands — everything you run, and what it means

All commands run **from the `frontend/` directory** unless stated otherwise.

---

## 0. One-time environment setup (this machine / WSL)

The frontend needs **Node 18+**. On this WSL box the default `PATH` picks up a
Windows Node **v16** from `/mnt/c/Program Files/nodejs`, which is too old and
breaks with `bash\r` / CRLF errors. Node 20 is installed via nvm; you must put
it FIRST on the PATH in every new shell:

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
```

What it means: prepends nvm's Node/npm so they win over the Windows ones.
Verify with `which node` (should print `~/.nvm/...`) and `node --version`
(v20.x). Tip: add that export line to `~/.bashrc` so it's automatic.

If nvm/Node are ever missing:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash  # install nvm
nvm install 20                                                                    # install Node 20
```

---

## 1. Daily commands

### `npm install`
Reads `package.json`, downloads all libraries into `node_modules/` and pins the
exact versions in `package-lock.json`. Run it once after cloning, and again
whenever `package.json` changes (e.g. after pulling someone's branch).

### `npm run dev`
Starts the **Vite dev server** at **http://localhost:5173**. This is your main
loop: edit a file → the browser updates instantly (HMR — hot module
replacement, no full reload). Ctrl-C stops it.
- Runs 100% on mock clients by default — **no backend needed**.
- Also proxies `/api` and `/boardfarm` requests to `http://localhost:8080`
  (the FastAPI backend) — relevant only when you enable backend mode (§3).

### `npm run typecheck`
Runs the TypeScript compiler in check-only mode (`tsc --noEmit`). Catches type
errors without producing any files. **Zero errors is the bar** — run it before
committing.

### `npm run test`
Runs all unit tests once with **Vitest** (currently 80 tests, ~2s). Tests live
next to the code they test (`*.test.ts`). Green before commit, always.

### `npm run test:watch`
Same tests, but stays running and re-runs the affected tests whenever you save
a file. Use while developing logic (clients, validation, the run engine).

### `npm run build`
Production build: first typechecks, then bundles/minifies everything into
`dist/` (static files you can serve from anywhere — nginx, the FastAPI app,
etc.). This is also the strictest "does everything compile" check.

### `npm run preview`
Serves the `dist/` folder from the last `npm run build` at a local URL — a
sanity check that the production bundle actually works (rarely needed).

---

## 2. Useful variants

```bash
npm run test -- src/lib/runs/engine.test.ts   # run ONE test file
npm run test -- -t "pauses at a gateway"      # run tests matching a name
npx vitest run --coverage                      # tests with a coverage report
npm run dev -- --port 5174                     # dev server on another port
npm run dev -- --host                          # expose to your LAN (test from another device)
```

The `--` separates npm's own arguments from the ones passed to the underlying
tool (vite / vitest).

---

## 3. Mock mode vs backend mode

The whole UI switches between in-browser mocks and the real API with **one
environment variable**, read at dev-server start:

```bash
# backend mode: create frontend/.env.local with the flag
echo "VITE_USE_BACKEND=1" > .env.local
npm run dev

# back to mock mode: remove the flag (or set it to anything but "1")
rm .env.local
npm run dev
```

What it means: every client seam's `index.ts` (auth, registries, persistence,
workflows, runs, artifacts, apps) picks `Http…Client` instead of
`Mock…Client`. Requires the FastAPI backend running (from the **repo root**,
not frontend/):

```bash
uvicorn api.app:app --host 0.0.0.0 --port 8080
```

`.env.local` is git-ignored and machine-local. Restart the dev server after
changing it — env vars are baked in at startup.

---

## 4. Housekeeping / when things act weird

```bash
rm -rf node_modules package-lock.json && npm install   # nuke & reinstall deps
rm -rf node_modules/.vite                              # clear Vite's cache (stale HMR/deps)
npx tsc --noEmit --watch                               # typecheck continuously in a terminal
lsof -i :5173                                          # who is holding the dev port
kill <pid>                                             # free it
```

- **"command not found: node/npm" or `bash\r` errors** → you forgot the PATH
  export from §0 (you're on the Windows Node).
- **Browser shows stale UI after big refactors** → hard reload
  (Ctrl+Shift+R); if persists, clear `node_modules/.vite` and restart dev.
- **Login loops** → the mock session lives in sessionStorage; open devtools →
  Application → Session Storage → clear, then reload.
- **Edits to config/runs vanish on reload** → expected in mock mode: mock
  stores are in-memory by design (see FRONTEND_ARCHITECTURE.md §1).

---

## 5. The pre-commit ritual

```bash
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
cd frontend
npm run typecheck && npm run test && npm run build
```

All three green = safe to commit. They are exactly what CI should run.
