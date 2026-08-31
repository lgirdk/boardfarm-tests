import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Layers,
  Play,
  Plus,
  Save,
  Wand2,
} from "lucide-react";
import { SlideOver } from "@/components/SlideOver";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { useWorkbench } from "@/lib/workbench";
import { environmentsClient } from "@/lib/environments";
import { bedsClient } from "@/lib/beds";
import { launchRun } from "@/lib/runs";
import {
  checkEnvironment,
  describeRequirement,
  resolveRequirement,
} from "@/lib/requirement";
import type { Bed, BoardTypeAvailability, EnvConfig } from "@/lib/contracts";

type EnvMode = "auto" | "saved" | "new";

/**
 * Set up run — the composer. Everything is pre-resolved so the default path is
 * read-and-confirm: the requirement is computed from the selection, a minimal
 * env is derived, and a free bed of the picked model is chosen for you.
 */
export function LaunchComposer() {
  const navigate = useNavigate();
  const { composerOpen, closeComposer, selected, remove, clear } = useWorkbench();

  const [envs, setEnvs] = useState<EnvConfig[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [avail, setAvail] = useState<BoardTypeAvailability[]>([]);

  const [envMode, setEnvMode] = useState<EnvMode>("auto");
  const [envId, setEnvId] = useState<string | null>(null);
  const [boardModel, setBoardModel] = useState<string | null>(null);
  const [bedPin, setBedPin] = useState("any");
  const [flash, setFlash] = useState(false);
  const [reset, setReset] = useState(false);
  const [stopOnFail, setStopOnFail] = useState(false);

  useEffect(() => {
    void environmentsClient.list().then(setEnvs);
    void bedsClient.list().then(setBeds);
    void bedsClient.availability().then(setAvail);
  }, []);

  // Default the board to the model with the most free beds once known.
  useEffect(() => {
    if (composerOpen && !boardModel && avail.length) {
      const pick = [...avail].sort((a, b) => b.free - a.free)[0];
      if (pick) setBoardModel(pick.board_model);
    }
  }, [composerOpen, avail, boardModel]);

  const req = useMemo(() => resolveRequirement(selected), [selected]);
  const reqChips = describeRequirement(req);

  const savedForModel = useMemo(
    () =>
      envs
        .filter((e) => e.board_model === boardModel)
        .map((e) => ({ e, fit: checkEnvironment(e, req) }))
        .sort(
          (a, b) =>
            Number(b.fit.ok) - Number(a.fit.ok) || b.e.updated_at - a.e.updated_at,
        ),
    [envs, boardModel, req],
  );

  const modelBeds = beds.filter((b) => b.board_model === boardModel);

  const estTests = selected.reduce((s, t) => s + (parseInt(t.runtime, 10) || 0), 0);
  const setup = (flash ? 9 : 0) + (reset ? 3 : 0) + 4;

  const chosenEnvName =
    envMode === "saved"
      ? (envs.find((e) => e.id === envId)?.name ?? "saved env")
      : `Auto · ${boardModel ?? ""} ${req?.modes[0] ?? ""}`.trim();

  const canRun =
    !!boardModel && !!req && !req.conflict && (envMode !== "saved" || !!envId);

  function runNow() {
    if (!canRun || !boardModel) return;
    const run = launchRun({
      testIds: selected.map((t) => t.id),
      testNames: selected.map((t) => t.name),
      boardModel,
      bedId: bedPin !== "any" ? bedPin : undefined,
      envName: chosenEnvName,
      flashFirmware: flash,
      factoryReset: reset,
    });
    clear();
    closeComposer();
    navigate(`/runs/${run.id}`);
  }

  return (
    <SlideOver
      open={composerOpen}
      onOpenChange={(o) => !o && closeComposer()}
      title="Set up run"
      description="Pre-filled from your selection. Change only what you need."
      widthClass="w-[720px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px]">
            <b>≈ {setup + estTests} min total</b>{" "}
            <span className="text-faint">
              · {setup}m setup + {estTests}m tests
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                closeComposer();
                navigate("/library/suites");
              }}
            >
              <Save className="h-3.5 w-3.5" /> Save as suite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                closeComposer();
                navigate("/schedules");
              }}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Schedule
            </Button>
            <Button variant="primary" size="sm" onClick={runNow} disabled={!canRun}>
              <Play className="h-3.5 w-3.5" /> Run now
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {req?.conflict && (
          <div className="rounded-[11px] border border-warning/45 bg-warning/5 p-3.5">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <b className="text-[13px]">These tests can&apos;t share one environment</b>
            </div>
            <p className="mt-1.5 text-[12px] text-muted">
              Your selection mixes provisioning modes that are mutually exclusive — the
              board would have to be re-provisioned mid-run.
            </p>
          </div>
        )}

        {/* 1 · tests */}
        <Section n={1} title="Tests">
          <div className="overflow-hidden rounded-[10px] border border-border">
            {selected.map((t, i) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <span className="w-4 font-mono text-[10.5px] text-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px] text-foreground">{t.name}</div>
                  <div className="text-[10.5px] text-faint">
                    {t.env_modes.join("/")} · {t.runtime}
                  </div>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-faint transition hover:text-danger"
                >
                  <Plus className="h-3.5 w-3.5 rotate-45" />
                </button>
              </div>
            ))}
            {selected.length === 0 && (
              <div className="px-3 py-3 text-[11.5px] text-faint">
                No tests selected. Pick some in the Library.
              </div>
            )}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-faint">
            <input
              type="checkbox"
              checked={stopOnFail}
              onChange={(e) => setStopOnFail(e.target.checked)}
              className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
            />
            Stop on first failure
          </label>
        </Section>

        {/* 2 · environment */}
        <Section n={2} title="Environment">
          <div className="rounded-[10px] border border-border-strong bg-surface-raised p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.06em] text-faint">
                Resolved requirement
              </span>
              {reqChips.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-accent/35 px-1.5 py-0.5 text-[10.5px] text-foreground"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-faint">
              Computed from the env_req markers of all {selected.length} selected tests.
            </p>
          </div>

          <div className="mt-2.5 space-y-2">
            <Opt active={envMode === "auto"} onClick={() => setEnvMode("auto")}>
              <div className="flex items-center gap-2">
                <Wand2 className="h-3.5 w-3.5 text-highlight" />
                <b className="text-[12.5px]">Build a minimal environment automatically</b>
                <span className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] text-faint">
                  recommended
                </span>
              </div>
              {envMode === "auto" && (
                <pre className="mt-2 overflow-auto rounded-[7px] border border-border bg-surface-inset px-2.5 py-2 font-mono text-[10.5px] text-muted">
{`{ "eRouter_Provisioning_mode": "${req?.modes[0] ?? "dual"}", "lan_clients": [${Array(req?.lanClients ?? 0).fill("{}").join(",")}]${req?.capabilities.includes("voice") ? ', "voice": {…}' : ""}${req?.capabilities.includes("tr069") ? ', "tr-069": {}' : ""} }`}
                </pre>
              )}
            </Opt>

            <Opt active={envMode === "saved"} onClick={() => setEnvMode("saved")}>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted" />
                <b className="text-[12.5px]">Use a saved environment</b>
                <span className="ml-auto text-[10.5px] text-faint">
                  {savedForModel.filter((x) => x.fit.ok).length} of {savedForModel.length} fit
                </span>
              </div>
              {envMode === "saved" && (
                <div className="mt-2 space-y-1.5">
                  {savedForModel.map(({ e, fit }) => (
                    <button
                      key={e.id}
                      disabled={!fit.ok}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setEnvId(e.id);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-[8px] border px-2.5 py-2 text-left transition",
                        !fit.ok && "cursor-not-allowed opacity-55",
                        envId === e.id
                          ? "border-accent/60 bg-accent/[0.07]"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          fit.ok ? "bg-ok" : "bg-idle",
                        )}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[11.5px] text-foreground">
                          {e.name}
                        </div>
                        <div className="text-[10px] text-faint">
                          {e.sku} · {e.prov_mode} · {e.lan} lan
                          {e.voice ? " · voice" : ""}
                          {e.tr069 ? " · tr069" : ""}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "ml-auto shrink-0 text-[10.5px]",
                          fit.ok ? "text-faint" : "text-warning",
                        )}
                      >
                        {fit.ok ? "fits" : fit.reason}
                      </span>
                    </button>
                  ))}
                  {savedForModel.length === 0 && (
                    <p className="text-[11px] text-faint">
                      No saved environments for {boardModel}. Auto-build one instead.
                    </p>
                  )}
                </div>
              )}
            </Opt>

            <Opt active={envMode === "new"} onClick={() => setEnvMode("new")}>
              <div className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5 text-muted" />
                <b className="text-[12.5px]">Create a new environment</b>
              </div>
              {envMode === "new" && (
                <div className="mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      closeComposer();
                      navigate("/lab/envs");
                    }}
                  >
                    Open the environment editor
                  </Button>
                  <p className="mt-1.5 text-[11px] text-faint">
                    Form and JSON stay in sync; comes back here when saved.
                  </p>
                </div>
              )}
            </Opt>
          </div>
        </Section>

        {/* 3 · board */}
        <Section n={3} title="Board">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {avail.map((a) => {
              const on = boardModel === a.board_model;
              return (
                <button
                  key={a.board_model}
                  onClick={() => {
                    setBoardModel(a.board_model);
                    setBedPin("any");
                    setEnvId(null);
                  }}
                  className={cn(
                    "rounded-[10px] border p-2.5 text-left transition",
                    on
                      ? "border-accent/60 bg-accent/[0.07]"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11.5px]">{a.board_model}</span>
                    {a.free > 0 ? (
                      <span className="rounded-full border border-ok/30 bg-ok/10 px-1.5 text-[9.5px] text-ok">
                        {a.free} free
                      </span>
                    ) : (
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 text-[9.5px] text-warning">
                        queue
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-idle">
                    {a.free > 0 && <span className="bg-ok" style={{ flex: a.free }} />}
                    {a.in_use > 0 && <span className="bg-running" style={{ flex: a.in_use }} />}
                    {a.offline > 0 && (
                      <span className="bg-danger/50" style={{ flex: a.offline }} />
                    )}
                  </div>
                  <div className="mt-1.5 text-[9.5px] text-faint">
                    {a.free > 0 ? "starts immediately" : "next free in ~6m"}
                  </div>
                </button>
              );
            })}
          </div>
          <select
            value={bedPin}
            onChange={(e) => setBedPin(e.target.value)}
            className="mt-2 w-full rounded-[9px] border border-border bg-surface-raised px-3 py-2 text-[12px] text-foreground outline-none focus:border-accent/60"
          >
            <option value="any">
              Any available {boardModel} bed — boardfarm picks (recommended)
            </option>
            {modelBeds.map((b) => (
              <option key={b.id} value={b.id} disabled={b.status !== "free"}>
                {b.id} · {b.location}
                {b.status !== "free" ? ` — ${b.status}` : ""}
              </option>
            ))}
          </select>
        </Section>

        {/* 4 · before it starts */}
        <Section n={4} title="Before the tests start">
          <div className="rounded-[10px] border border-border">
            <Toggle
              label="Flash firmware"
              sub={
                envMode === "saved"
                  ? (envs.find((e) => e.id === envId)?.firmware ?? "from the environment")
                  : "ofw-…-r18 (from environment)"
              }
              cost="+9 min"
              value={flash}
              onChange={setFlash}
            />
            <div className="border-t border-border/60" />
            <Toggle
              label="Factory reset first"
              sub="Clean state — recommended after a failed run left the board configured"
              cost="+3 min"
              value={reset}
              onChange={setReset}
            />
          </div>
        </Section>
      </div>
    </SlideOver>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-[11px] font-medium text-muted">
          {n}
        </span>
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Opt({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[10px] border p-3 transition",
        active ? "border-accent/60 bg-accent/[0.05]" : "border-border hover:border-border-strong",
      )}
    >
      {children}
    </div>
  );
}

function Toggle({
  label,
  sub,
  cost,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  cost: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-foreground">{label}</div>
        <div className="truncate text-[10.5px] text-faint">{sub}</div>
      </div>
      <span className="text-[10.5px] text-faint">{cost}</span>
      {value && <Check className="h-3.5 w-3.5 text-accent" />}
    </label>
  );
}
