import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Cpu,
  Layers,
  Play,
  Plus,
  Rocket,
  Search,
  Wand2,
  X,
} from "lucide-react";
import { testsClient } from "@/lib/tests";
import { bedsClient } from "@/lib/beds";
import { buildEnvContent, environmentsClient } from "@/lib/environments";
import { launchRun } from "@/lib/runs";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import type {
  BoardTypeAvailability,
  EnvConfig,
  EnvProvMode,
  TestAsset,
} from "@/lib/contracts";

const PROV_MODES = new Set(["ipv4", "ipv6", "dual", "disabled"]);
const AUTO = "__auto__";

/**
 * Guided run setup — the whole "run a test" journey on one page: pick tests,
 * pick a board TYPE (with live availability), then an environment inline
 * (auto-suggested from the tests' env_req, or auto-generated). Launch triggers
 * the boardfarm execution run and drops you on its live detail.
 */
export function NewRunPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [catalog, setCatalog] = useState<TestAsset[]>([]);
  const [avail, setAvail] = useState<BoardTypeAvailability[]>([]);
  const [envs, setEnvs] = useState<EnvConfig[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => params.get("tests")?.split(",").filter(Boolean).map(decodeURIComponent) ?? [],
  );
  const [boardModel, setBoardModel] = useState<string | null>(null);
  const [envId, setEnvId] = useState<string>(AUTO);
  const [query, setQuery] = useState("");
  const [flashFirmware, setFlashFirmware] = useState(false);
  const [factoryReset, setFactoryReset] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let active = true;
    void testsClient.list().then((t) => active && setCatalog(t));
    void bedsClient.availability().then((a) => active && setAvail(a));
    void environmentsClient.list().then((e) => active && setEnvs(e));
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => selectedIds.map((id) => catalog.find((t) => t.id === id)).filter(Boolean) as TestAsset[],
    [selectedIds, catalog],
  );

  // env_req tags required by the selected tests.
  const envReqTags = useMemo(() => {
    const s = new Set<string>();
    for (const t of selected) if (t.env_req) s.add(t.env_req);
    return [...s];
  }, [selected]);

  const featureReqs = useMemo(
    () => envReqTags.filter((t) => t === "wifi" || t === "voice"),
    [envReqTags],
  );
  const primaryEnvReq = useMemo(
    () => envReqTags.find((t) => PROV_MODES.has(t)) ?? envReqTags[0] ?? "dual",
    [envReqTags],
  );

  function compatible(a: BoardTypeAvailability): boolean {
    return featureReqs.every((f) => a.features.includes(f));
  }

  // Auto-pick a sensible board once tests/availability are known.
  useEffect(() => {
    if (boardModel || avail.length === 0) return;
    const pick =
      avail.find((a) => compatible(a) && a.free > 0) ??
      avail.find((a) => a.free > 0) ??
      avail[0];
    if (pick) setBoardModel(pick.board_model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avail, selected]);

  // Preselect env from ?env= if provided.
  useEffect(() => {
    const q = params.get("env");
    if (q) setEnvId(decodeURIComponent(q));
  }, [params]);

  const suggestedEnvs = useMemo(() => {
    if (!boardModel) return [];
    return envs.filter(
      (e) => e.board_model === boardModel && e.env_tags.includes(primaryEnvReq),
    );
  }, [envs, boardModel, primaryEnvReq]);

  const boardEnvs = useMemo(
    () => (boardModel ? envs.filter((e) => e.board_model === boardModel) : []),
    [envs, boardModel],
  );

  const autoEnv = useMemo<EnvConfig | null>(() => {
    if (!boardModel) return null;
    const prov = (PROV_MODES.has(primaryEnvReq) ? primaryEnvReq : "dual") as EnvProvMode;
    const p = {
      board_model: boardModel,
      sku: "UPC",
      prov_mode: prov,
      wifi: envReqTags.includes("wifi"),
      voice: envReqTags.includes("voice"),
    };
    return {
      id: AUTO,
      name: `Auto · ${boardModel} ${prov}${p.wifi ? " +wifi" : ""}${p.voice ? " +voice" : ""}`,
      ...p,
      lan: 2,
      tr069: false,
      wifi_bands: p.wifi ? ["5"] : [],
      visibility: "private",
      owner: "you",
      updated_at: Date.now(),
      env_tags: [prov, ...(p.wifi ? ["wifi"] : []), ...(p.voice ? ["voice"] : [])],
      content: buildEnvContent(p),
    };
  }, [boardModel, primaryEnvReq, envReqTags]);

  const chosenEnv = envId === AUTO ? autoEnv : envs.find((e) => e.id === envId) ?? autoEnv;
  const boardAvail = avail.find((a) => a.board_model === boardModel);
  const canLaunch =
    selected.length > 0 && !!boardModel && !!chosenEnv && (boardAvail?.free ?? 0) > 0;

  const searchMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((t) => !selectedIds.includes(t.id))
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.suite.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      )
      .slice(0, 6);
  }, [catalog, query, selectedIds]);

  async function launch() {
    if (!canLaunch || !chosenEnv || !boardModel) return;
    setLaunching(true);
    const run = launchRun({
      testIds: selectedIds,
      testNames: selected.map((t) => t.name),
      boardModel,
      envName: chosenEnv.name,
      flashFirmware,
      factoryReset,
    });
    navigate(`/runs/${run.id}`);
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2 text-[11px] text-faint">
          <Link to="/runs" className="hover:text-foreground">
            Runs
          </Link>
          <span>/</span>
          <span className="text-muted">new</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Start a run</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Pick tests, a board type, and an environment. Boardfarm reserves a free bed,
          flashes, provisions, runs, and cleans up.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 px-6 py-6 lg:grid-cols-[1fr_320px]">
        {/* guided steps */}
        <div className="space-y-4">
          {/* 1 · tests */}
          <StepCard n={1} title="Tests" done={selected.length > 0}>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((t) => (
                <span
                  key={t.id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-1 text-[11.5px]"
                >
                  <span className="font-mono text-foreground">{t.name}</span>
                  {t.env_req && (
                    <span className="rounded bg-highlight/10 px-1 font-mono text-[10px] text-highlight">
                      {t.env_req}
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedIds((p) => p.filter((x) => x !== t.id))}
                    className="text-faint hover:text-danger"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {selected.length === 0 && (
                <span className="text-[11.5px] text-faint">No tests yet — add some below.</span>
              )}
            </div>

            <div className="relative mt-3 max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add a test…"
                className="w-full rounded-[9px] border border-border bg-surface-raised py-2 pl-8 pr-3 text-[12.5px] outline-none transition placeholder:text-faint focus:border-accent/60"
              />
              {searchMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-[9px] border border-border bg-surface shadow-lg">
                  {searchMatches.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedIds((p) => [...p, t.id]);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition hover:bg-surface-raised"
                    >
                      <Plus className="h-3 w-3 text-accent" />
                      <span className="font-mono text-foreground">{t.name}</span>
                      <span className="ml-auto text-[10.5px] text-faint">{t.suite}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </StepCard>

          {/* 2 · board */}
          <StepCard n={2} title="Board" done={!!boardModel}>
            {envReqTags.length > 0 && (
              <p className="mb-2 text-[11px] text-faint">
                Selected tests need{" "}
                <span className="font-mono text-muted">{envReqTags.join(", ")}</span> — boards
                below are matched for you.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {avail.map((a) => {
                const active = boardModel === a.board_model;
                const compat = compatible(a);
                const runnable = a.free > 0;
                return (
                  <button
                    key={a.board_model}
                    onClick={() => setBoardModel(a.board_model)}
                    className={cn(
                      "rounded-[10px] border p-2.5 text-left transition",
                      active
                        ? "border-accent/60 bg-accent/[0.08]"
                        : "border-border bg-surface/40 hover:border-border-strong",
                      !runnable && "opacity-55",
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[12px] text-foreground">
                        {a.board_model}
                      </span>
                      {active && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      <span className={cn(runnable ? "text-ok" : "text-faint")}>
                        {a.free} free
                      </span>
                      <span className="text-faint">/ {a.total}</span>
                    </div>
                    {!compat && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-warning">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        missing {featureReqs.filter((f) => !a.features.includes(f)).join(", ")}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </StepCard>

          {/* 3 · environment */}
          <StepCard n={3} title="Environment" done={!!chosenEnv}>
            <div className="space-y-1.5">
              <EnvOption
                active={envId === AUTO}
                onClick={() => setEnvId(AUTO)}
                icon={<Wand2 className="h-3.5 w-3.5 text-highlight" />}
                title={autoEnv?.name ?? "Auto"}
                subtitle="Generated to satisfy the tests' env_req"
                badge="auto"
              />
              {suggestedEnvs.length > 0 && (
                <div className="pt-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">
                  Suggested
                </div>
              )}
              {suggestedEnvs.map((e) => (
                <EnvOption
                  key={e.id}
                  active={envId === e.id}
                  onClick={() => setEnvId(e.id)}
                  icon={<Layers className="h-3.5 w-3.5 text-muted" />}
                  title={e.name}
                  subtitle={`${e.sku} · ${e.env_tags.join(", ")}`}
                  badge={e.visibility === "published" ? "team" : "private"}
                />
              ))}
              {boardEnvs.filter((e) => !suggestedEnvs.includes(e)).length > 0 && (
                <div className="pt-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">
                  Other {boardModel} environments
                </div>
              )}
              {boardEnvs
                .filter((e) => !suggestedEnvs.includes(e))
                .map((e) => (
                  <EnvOption
                    key={e.id}
                    active={envId === e.id}
                    onClick={() => setEnvId(e.id)}
                    icon={<Layers className="h-3.5 w-3.5 text-faint" />}
                    title={e.name}
                    subtitle={`${e.sku} · ${e.env_tags.join(", ")}`}
                    badge={e.visibility === "published" ? "team" : "private"}
                  />
                ))}
            </div>
          </StepCard>
        </div>

        {/* summary rail */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[12px] border border-border bg-surface/50 p-4">
            <h3 className="text-[13px] font-semibold">Summary</h3>
            <dl className="mt-3 space-y-2.5 text-[12px]">
              <SummaryRow label="Tests" value={`${selected.length} selected`} />
              <SummaryRow
                label="Board"
                value={boardModel ?? "—"}
                sub={boardAvail ? `${boardAvail.free} free of ${boardAvail.total}` : undefined}
                icon={<Cpu className="h-3.5 w-3.5 text-faint" />}
              />
              <SummaryRow
                label="Environment"
                value={chosenEnv?.name ?? "—"}
                icon={<Layers className="h-3.5 w-3.5 text-faint" />}
              />
              <SummaryRow label="env_req" value={primaryEnvReq} mono />
            </dl>

            {boardAvail && boardAvail.free === 0 && (
              <div className="mt-3 flex items-start gap-1.5 rounded-[8px] border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                No free {boardModel} bed right now — the run will queue until one frees up.
              </div>
            )}

            <div className="mt-3 space-y-0.5 border-t border-border pt-3">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">
                Before it starts
              </div>
              <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={flashFirmware}
                  onChange={(e) => setFlashFirmware(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                />
                <span className="text-muted">Flash firmware</span>
                <span className="ml-auto text-[10.5px] text-faint">+9m</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={factoryReset}
                  onChange={(e) => setFactoryReset(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                />
                <span className="text-muted">Factory reset first</span>
                <span className="ml-auto text-[10.5px] text-faint">+3m</span>
              </label>
            </div>

            <Button
              variant="primary"
              className="mt-4 w-full justify-center"
              onClick={() => void launch()}
              disabled={!canLaunch || launching}
            >
              <Play className="h-4 w-4" />
              {launching ? "Launching…" : "Launch run"}
            </Button>
            <p className="mt-2 text-center text-[10.5px] text-faint">
              Reserves a bed · flashes · provisions · runs · cleans up
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
            done ? "bg-brand-gradient text-accent-fg" : "border border-border text-faint",
          )}
        >
          {done ? <Check className="h-3 w-3" /> : n}
        </span>
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EnvOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[9px] border px-3 py-2 text-left transition",
        active
          ? "border-accent/60 bg-accent/[0.08]"
          : "border-border bg-surface/40 hover:border-border-strong",
      )}
    >
      {icon}
      <div className="min-w-0">
        <div className="truncate text-[12.5px] text-foreground">{title}</div>
        <div className="truncate text-[10.5px] text-faint">{subtitle}</div>
      </div>
      <span className="ml-auto rounded-full border border-border px-1.5 py-0.5 text-[9.5px] text-faint">
        {badge}
      </span>
      {active && <Check className="h-3.5 w-3.5 text-accent" />}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  sub,
  icon,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-faint">{label}</dt>
      <dd className="flex items-center gap-1 text-right">
        {icon}
        <span>
          <span className={cn("text-foreground", mono && "font-mono")}>{value}</span>
          {sub && <span className="block text-[10.5px] text-faint">{sub}</span>}
        </span>
      </dd>
    </div>
  );
}
