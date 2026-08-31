import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  FileCode2,
  OctagonX,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import { CodeView } from "@/components/CodeView";
import { runsClient } from "@/lib/runs";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import { artifactsClient } from "@/lib/artifacts";
import { fmtAgo, fmtDuration } from "@/lib/time";
import { cn } from "@/lib/cn";
import type { AnalysisReport, Artifact, ConsoleLine, ConsoleLevel, FindingSeverity, Run, RunArtifact, RunStep } from "@/lib/contracts";
import { defaultFocusStep } from "./runRail";
import { RunLogTerminal } from "./RunLogTerminal";

/**
 * The signature screen: live run detail. Left, the vertical step rail; right,
 * the focused step's artifacts and — when awaiting approval — the approval bar.
 * Live-updates through runsClient.subscribe.
 */
export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { run, notFound } = useRunSubscription(id);

  if (notFound) {
    return (
      <div className="px-8 py-10 text-sm text-muted">
        No run with id <code className="font-mono">{id}</code>. It may have been created
        in a previous session — start a run to see a live one.
      </div>
    );
  }
  if (!run) {
    return <div className="px-8 py-10 text-sm text-faint">Loading run…</div>;
  }

  // Test executions get the boardfarm phase layout; pipelines/app runs keep the
  // gate-oriented rail (they pause for human approval).
  return run.workflow === "test-run" ? (
    <ExecutionRunView run={run} />
  ) : (
    <PipelineRunView run={run} />
  );
}

/* ───────────────────────────── test executions ───────────────────────── */

const PHASES: { key: string; label: string }[] = [
  { key: "reserve", label: "reserve" },
  { key: "flash", label: "flash" },
  { key: "factory_reset", label: "factory reset" },
  { key: "provision", label: "provision" },
  { key: "execute", label: "execute" },
  { key: "collect", label: "collect" },
  { key: "release", label: "release" },
];

type ExecTab = "console" | "test" | "artifacts" | "analysis";

function ExecutionRunView({ run }: { run: Run }) {
  const navigate = useNavigate();
  const names = useMemo<string[]>(
    () => (run.input?.test_names as string[] | undefined) ?? [],
    [run.input],
  );
  const [tab, setTab] = useState<ExecTab>(run.status === "failed" ? "analysis" : "console");
  const [focus, setFocus] = useState(0);
  const [notify, setNotify] = useState(false);

  const terminal =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled";
  const executeStep = run.steps.find((s) => s.name === "execute");
  const reachedExecute =
    (executeStep &&
      (executeStep.state === "running" ||
        executeStep.state === "completed" ||
        executeStep.state === "failed")) ||
    terminal;

  const what =
    names.length === 1 ? names[0] : `${names.length || run.input?.test_count || 0} tests`;
  const tStates = testStates(run, names);

  return (
    <div className="px-6 py-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-faint">run/</span>
            <h1 className="font-mono text-[15px] text-foreground">{what}</h1>
            <StatusChip status={run.status} />
          </div>
          <div className="mt-1 text-[11.5px] text-faint">
            #{run.id} · bed{" "}
            <span className="font-mono text-muted">{String(run.input?.bed ?? "—")}</span> · env{" "}
            <span className="font-mono text-muted">{String(run.input?.env_name ?? "—")}</span> · by{" "}
            {run.triggered_by} · {fmtAgo(run.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library?tab=suites")}>
            <Save className="h-3.5 w-3.5" /> Save as suite
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setNotify((v) => !v)}>
            <Bell className="h-3.5 w-3.5" /> {notify ? "Watching" : "Notify me"}
          </Button>
          {!terminal ? (
            <Button variant="secondary" size="sm" onClick={() => void runsClient.cancel(run.id)}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(
                  `/runs/new?tests=${((run.input?.tests as string[]) ?? [])
                    .map(encodeURIComponent)
                    .join(",")}`,
                )
              }
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </Button>
          )}
        </div>
      </div>

      {/* phase strip */}
      <div className="mt-4 flex items-stretch gap-1.5">
        {PHASES.map((p) => {
          const step = run.steps.find((s) => s.name === p.key);
          const state = step?.state ?? "skipped";
          const active = state === "running";
          const done = state === "completed";
          return (
            <div
              key={p.key}
              className={cn(
                "relative min-w-0 flex-1 overflow-hidden rounded-[9px] border px-2.5 py-2",
                done && "border-ok/30",
                active && "border-running/45 bg-running/5",
                !done && !active && "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "truncate text-[11.5px]",
                    active
                      ? "font-semibold text-running"
                      : state === "pending" || state === "skipped"
                        ? "text-faint"
                        : "text-foreground",
                  )}
                >
                  {p.label}
                </span>
                {done && <Check className="h-3 w-3 shrink-0 text-ok" />}
                {active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-running" />}
              </div>
              <div className="mt-1 font-mono text-[10px] text-faint">{phaseElapsed(step)}</div>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 w-3/5 bg-running" />}
              {done && <span className="absolute inset-x-0 bottom-0 h-0.5 w-full bg-ok" />}
            </div>
          );
        })}
      </div>

      {/* body adapts to phase: setup → console dominates; execution → split */}
      {!reachedExecute ? (
        <div className="mt-4">
          <p className="mb-2 text-[11.5px] text-faint">
            Setup in progress — reserving the bed, flashing and provisioning. Watch the console.
          </p>
          <div className="overflow-hidden rounded-[11px] border border-border">
            <RunConsole run={run} tall />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          {/* left: tests + bed facts */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[11px] border border-border">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-[11px] uppercase tracking-[0.05em] text-faint">Tests</span>
                <span className="text-[11px] text-faint">
                  {tStates.filter((s) => s === "passed").length} of {names.length || 1} done
                </span>
              </div>
              {names.map((n, i) => (
                <button
                  key={n}
                  onClick={() => {
                    setFocus(i);
                    setTab("test");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-t border-border/60 px-3.5 py-2.5 text-left transition hover:bg-surface/50",
                    focus === i && tab === "test" && "bg-accent/[0.06]",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      tStates[i] === "passed"
                        ? "bg-ok"
                        : tStates[i] === "running"
                          ? "animate-pulse-dot bg-running"
                          : tStates[i] === "failed"
                            ? "bg-danger"
                            : "bg-idle",
                    )}
                  />
                  <span className="truncate font-mono text-[11.5px] text-foreground">{n}</span>
                </button>
              ))}
              {names.length === 0 && (
                <div className="border-t border-border/60 px-3.5 py-3 text-[11.5px] text-faint">
                  No test list on this run.
                </div>
              )}
            </div>

            <div className="rounded-[11px] border border-border p-3.5">
              <div className="text-[11px] uppercase tracking-[0.05em] text-faint">Bed</div>
              <dl className="mt-2 grid grid-cols-[74px_1fr] gap-y-1 text-[11.5px]">
                <dt className="text-faint">bed</dt>
                <dd className="truncate font-mono text-foreground">{String(run.input?.bed ?? "—")}</dd>
                <dt className="text-faint">model</dt>
                <dd className="text-muted">{String(run.input?.board_model ?? "—")}</dd>
                <dt className="text-faint">firmware</dt>
                <dd className="truncate font-mono text-muted">
                  {String(run.steps.find((s) => s.name === "flash")?.details?.image ?? "unchanged")}
                </dd>
                <dt className="text-faint">eRouter</dt>
                <dd className="font-mono text-muted">
                  {String(run.steps.find((s) => s.name === "provision")?.details?.erouter_ipv4 ?? "—")}
                </dd>
              </dl>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full justify-center"
                onClick={() => navigate("/boards")}
              >
                Board details
              </Button>
            </div>
          </div>

          {/* right: tabbed detail */}
          <div className="min-w-0 overflow-hidden rounded-[11px] border border-border">
            <div className="flex gap-1 border-b border-border px-2">
              {(
                [
                  ["console", "Console"],
                  ["test", "Current test"],
                  ["artifacts", "Artifacts"],
                  ["analysis", "Analysis"],
                ] as [ExecTab, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-[12px] transition",
                    tab === k
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <div>
              {tab === "console" && <RunConsole run={run} />}
              {tab === "test" && <CurrentTestPanel run={run} name={names[focus]} />}
              {tab === "artifacts" && <ArtifactsPanel run={run} />}
              {tab === "analysis" && <AnalysisPanel run={run} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function phaseElapsed(step?: RunStep): string {
  if (!step || step.state === "skipped") return "skipped";
  if (step.state === "pending" || !step.started_at) return "—";
  return fmtDuration((step.finished_at ?? Date.now()) - step.started_at);
}

function testStates(
  run: Run,
  names: string[],
): ("passed" | "running" | "pending" | "failed")[] {
  const ex = run.steps.find((s) => s.name === "execute");
  if (!ex || ex.state === "pending") return names.map(() => "pending");
  if (ex.state === "running") return names.map((_, i) => (i === 0 ? "running" : "pending"));
  if (ex.state === "failed")
    return names.map((_, i) => (i === names.length - 1 ? "failed" : "passed"));
  return names.map(() => "passed");
}

const LEVEL: Record<ConsoleLevel, string> = {
  i: "text-muted",
  w: "text-warning",
  e: "text-danger",
  ok: "text-ok",
};

function RunConsole({ run, tall }: { run: Run; tall?: boolean }) {
  const [all, setAll] = useState<ConsoleLine[]>([]);
  const [filter, setFilter] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void runsClient.console(run.id).then((lines) => active && setAll(lines));
    return () => { active = false; };
  }, [run.id, run.steps]);

  const lines = all.filter(
    (l) =>
      (!errorsOnly || l.level === "e" || l.level === "w") &&
      (!filter || l.text.toLowerCase().includes(filter.toLowerCase())),
  );
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [all.length]);
  const live = run.status === "running" || run.status === "awaiting_approval";

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter log lines…"
          className="flex-1 rounded-[7px] border border-border bg-surface-raised px-2.5 py-1.5 text-[11.5px] outline-none placeholder:text-faint focus:border-accent/60"
        />
        <button
          onClick={() => setErrorsOnly((v) => !v)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] transition",
            errorsOnly
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-border text-muted hover:text-foreground",
          )}
        >
          errors only
        </button>
        <button
          onClick={() => downloadText(`${run.id}.log`, lines.map((l) => `${fmtClock(l.ts)} ${l.src} ${l.text}`).join("\n"))}
          title="Download log"
          className="rounded-[7px] border border-border p-1.5 text-faint transition hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={cn(
          "overflow-auto bg-surface-inset px-3 py-2.5 font-mono text-[11.5px] leading-relaxed",
          tall ? "max-h-[440px]" : "max-h-[380px]",
        )}
      >
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="shrink-0 select-none text-faint">{fmtClock(l.ts)}</span>
            <span className="shrink-0 select-none text-highlight">{l.src.padEnd(10)}</span>
            <span className={cn("whitespace-pre-wrap", LEVEL[l.level])}>{l.text}</span>
          </div>
        ))}
        {lines.length === 0 && <span className="text-faint">No lines.</span>}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-[10px] text-faint">
        {live && (
          <span className="flex items-center gap-1 text-running">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-running" /> streaming
          </span>
        )}
        <span className="ml-auto">
          replay of a recorded boardfarm run · live stdout when the bridge is connected
        </span>
      </div>
    </div>
  );
}


function CurrentTestPanel({ run, name }: { run: Run; name?: string }) {
  if (!name) return <div className="px-4 py-6 text-[12px] text-faint">Select a test on the left.</div>;
  const ex = run.steps.find((s) => s.name === "execute");
  const running = ex?.state === "running";
  const doneAll = ex?.state === "completed" || run.status === "completed";
  const steps = [
    `Bring the board up for ${name.replace(/^test_/, "").replace(/_/g, " ")}`,
    "Exercise the behaviour under test",
    "Verify the expected result",
  ];
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <FileCode2 className="h-4 w-4 text-accent" />
        <span className="font-mono text-[12.5px]">{name}</span>
      </div>
      <div className="mt-3 divide-y divide-border/60">
        {steps.map((s, i) => {
          const st = doneAll ? "done" : running && i === 0 ? "run" : "wait";
          return (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  st === "done" ? "bg-ok" : st === "run" ? "animate-pulse-dot bg-running" : "bg-idle",
                )}
              />
              <span className="font-mono text-[10.5px] text-faint">Step {i + 1}</span>
              <span className={cn("text-[12px]", st === "wait" ? "text-faint" : "text-muted")}>{s}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 border-l-2 border-accent pl-2.5 text-[11.5px] text-muted">
        Step names come from <span className="font-mono">bf_logger.log_step()</span> in the test source.
      </p>
    </div>
  );
}

function ArtifactsPanel({ run }: { run: Run }) {
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([]);
  useEffect(() => {
    let active = true;
    void runsClient.runArtifacts(run.id).then((a) => active && setArtifacts(a));
    return () => { active = false; };
  }, [run.id, run.steps]);

  if (artifacts.length === 0)
    return (
      <div className="px-4 py-6 text-[12px] text-faint">
        Artifacts appear once the run collects them.
      </div>
    );
  return (
    <div className="p-4">
      {artifacts.map((a) => (
        <div
          key={a.name}
          className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0"
        >
          <div>
            <div className="font-mono text-[12px] text-foreground">{a.name}</div>
            <div className="text-[11px] text-faint">{a.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-faint">{a.size}</span>
            <button
              onClick={() => downloadText(a.name, `// ${a.name} from run ${run.id}`)}
              className="inline-flex items-center gap-1 rounded-[7px] border border-border px-2 py-1 text-[11px] text-muted transition hover:text-foreground"
            >
              <Download className="h-3 w-3" /> Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisPanel({ run }: { run: Run }) {
  if (run.status !== "failed" || !run.error) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-[13px] text-foreground">Nothing has failed</div>
        <p className="mx-auto mt-1.5 max-w-sm text-[12px] text-faint">
          If a test fails, the log analyzer runs here automatically and points at the likely
          cause — you don&apos;t have to go anywhere else.
        </p>
      </div>
    );
  }
  return (
    <div className="p-4">
      <FailureAnalysis run={run} />
    </div>
  );
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ───────────────────────── pipeline / app runs ───────────────────────── */

function PipelineRunView({ run }: { run: Run }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"console" | "step" | "artifacts" | "analysis">(
    run.status === "failed" ? "analysis" : "step",
  );
  const [focus, setFocus] = useState<string | undefined>();
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!userPicked) setFocus(defaultFocusStep(run));
  }, [run, userPicked]);

  const terminal =
    run.status === "completed" || run.status === "failed" || run.status === "cancelled";
  const focusStep = run.steps.find((s) => s.name === focus);
  const gate = run.steps.find((s) => s.state === "awaiting_approval");
  const doneCount = run.steps.filter((s) => s.state === "completed").length;

  function focusOn(name: string) {
    setFocus(name);
    setUserPicked(true);
    setTab("step");
  }

  return (
    <div className="px-6 py-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs text-faint">run/</span>
            <h1 className="font-mono text-[15px] text-foreground">{run.workflow_title}</h1>
            <StatusChip status={run.status} />
          </div>
          <div className="mt-1 text-[11.5px] text-faint">
            #{run.id} · <span className="font-mono text-muted">{run.workflow}</span> · by{" "}
            {run.triggered_by} · {fmtAgo(run.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!terminal ? (
            <Button variant="secondary" size="sm" onClick={() => void runsClient.cancel(run.id)}>
              Cancel
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => navigate("/pipelines")}>
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </Button>
          )}
        </div>
      </div>

      {/* approval gate */}
      {gate && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[11px] border border-warning/45 bg-warning/[0.06] px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <div className="text-[12.5px]">
            <b>{gate.title}</b> is waiting on you.{" "}
            <span className="text-muted">Review the output so far, then continue.</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => void runsClient.approve(run.id)}>
              Approve &amp; continue
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void runsClient.cancel(run.id)}>
              Request changes
            </Button>
          </div>
        </div>
      )}

      {/* failed banner */}
      {run.status === "failed" && run.error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
          <OctagonX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="text-[12.5px] leading-relaxed">
            <span className="font-mono text-danger">{run.error.step}</span>{" "}
            <span className="text-danger">failed.</span>{" "}
            <span className="text-muted">{run.error.message}</span>
          </div>
        </div>
      )}

      {/* step strip */}
      <div className="mt-4 flex items-stretch gap-1.5">
        {run.steps.map((s) => {
          const running = s.state === "running";
          const gated = s.state === "awaiting_approval";
          const done = s.state === "completed";
          const failed = s.state === "failed";
          return (
            <button
              key={s.name}
              onClick={() => focusOn(s.name)}
              className={cn(
                "relative min-w-0 flex-1 overflow-hidden rounded-[9px] border px-2.5 py-2 text-left transition",
                done && "border-ok/30",
                running && "border-running/45 bg-running/5",
                gated && "border-warning/50 bg-warning/5",
                failed && "border-danger/45 bg-danger/5",
                !done && !running && !gated && !failed && "border-border",
                focus === s.name && "ring-1 ring-accent/40",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "truncate text-[11.5px]",
                    running || gated
                      ? "font-semibold text-foreground"
                      : s.state === "pending" || s.state === "skipped"
                        ? "text-faint"
                        : "text-foreground",
                  )}
                >
                  {s.title}
                </span>
                {done && <Check className="h-3 w-3 shrink-0 text-ok" />}
                {running && <span className="h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-running" />}
                {gated && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />}
                {failed && <OctagonX className="h-3 w-3 shrink-0 text-danger" />}
              </div>
              <div className="mt-1 font-mono text-[10px] text-faint">{phaseElapsed(s)}</div>
              {done && <span className="absolute inset-x-0 bottom-0 h-0.5 w-full bg-ok" />}
              {running && <span className="absolute inset-x-0 bottom-0 h-0.5 w-3/5 bg-running" />}
            </button>
          );
        })}
      </div>

      {/* two-column */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* left: steps + facts */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[11px] border border-border">
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-[11px] uppercase tracking-[0.05em] text-faint">Steps</span>
              <span className="text-[11px] text-faint">
                {doneCount} of {run.steps.length} done
              </span>
            </div>
            {run.steps.map((s) => (
              <button
                key={s.name}
                onClick={() => focusOn(s.name)}
                className={cn(
                  "flex w-full items-start gap-2 border-t border-border/60 px-3.5 py-2.5 text-left transition hover:bg-surface/50",
                  focus === s.name && tab === "step" && "bg-accent/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    s.state === "completed"
                      ? "bg-ok"
                      : s.state === "running"
                        ? "animate-pulse-dot bg-running"
                        : s.state === "awaiting_approval"
                          ? "bg-warning"
                          : s.state === "failed"
                            ? "bg-danger"
                            : "bg-idle",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-foreground">{s.title}</div>
                  {s.summary && (
                    <div className="truncate text-[10.5px] text-faint">{s.summary}</div>
                  )}
                </div>
                {s.approval && (
                  <span className="mt-0.5 shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[9.5px] text-faint">
                    gate
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="rounded-[11px] border border-border p-3.5">
            <div className="text-[11px] uppercase tracking-[0.05em] text-faint">Pipeline</div>
            <dl className="mt-2 grid grid-cols-[84px_1fr] gap-y-1 text-[11.5px]">
              <dt className="text-faint">workflow</dt>
              <dd className="truncate font-mono text-foreground">{run.workflow}</dd>
              <dt className="text-faint">triggered</dt>
              <dd className="text-muted">{run.triggered_by}</dd>
              <dt className="text-faint">workspace</dt>
              <dd className="text-muted">{run.workspace}</dd>
            </dl>
          </div>
        </div>

        {/* right: tabbed detail */}
        <div className="min-w-0 overflow-hidden rounded-[11px] border border-border">
          <div className="flex gap-1 border-b border-border px-2">
            {(
              [
                ["console", "Console"],
                ["step", "Current step"],
                ["artifacts", "Artifacts"],
                ["analysis", "Analysis"],
              ] as ["console" | "step" | "artifacts" | "analysis", string][]
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "border-b-2 px-3 py-2 text-[12px] transition",
                  tab === k
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div>
            {tab === "console" && (
              <div className="p-3">
                <RunLogTerminal run={run} />
              </div>
            )}
            {tab === "step" &&
              (focusStep ? (
                <div className="p-4">
                  <StepDetail run={run} stepName={focusStep.name} />
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-faint">Select a step.</p>
              ))}
            {tab === "artifacts" && <PipelineArtifactsPanel run={run} />}
            {tab === "analysis" && <AnalysisPanel run={run} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineArtifactsPanel({ run }: { run: Run }) {
  const ids = useMemo(() => run.steps.flatMap((s) => s.artifact_ids ?? []), [run.steps]);
  const [arts, setArts] = useState<Artifact[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all(ids.map((id) => artifactsClient.get(id))).then((r) => {
      if (active) setArts(r.filter((a): a is Artifact => !!a));
    });
    return () => {
      active = false;
    };
  }, [ids]);

  if (arts.length === 0)
    return (
      <div className="px-4 py-6 text-[12px] text-faint">
        No artifacts produced by this pipeline yet.
      </div>
    );
  return (
    <div className="space-y-3 p-4">
      {arts.map((a) => (
        <div key={a.id}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[12px] text-foreground">{a.name}</span>
            <span className="text-[11px] text-faint">
              v{a.version} · {a.status}
            </span>
          </div>
          <CodeView code={a.content} language={a.language} />
        </div>
      ))}
    </div>
  );
}

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  critical: "border-danger/40 bg-danger/10 text-danger",
  major: "border-warning/40 bg-warning/10 text-warning",
  minor: "border-border bg-surface-raised text-muted",
};

/** Lightweight inline analysis derived from the failure — the Log Analyzer,
 * folded into the run where you actually need it. */
function FailureAnalysis({ run }: { run: Run }) {
  const report = analyzeError(run.error!.message);
  return (
    <div className="mt-3 rounded-[11px] border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-highlight" />
        <span className="text-[13px] font-semibold">Failure analysis</span>
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-faint">
          auto · inline
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted">{report.summary}</p>
      <div className="mt-2.5 space-y-1.5">
        {report.findings.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-[8px] border border-border bg-surface-inset px-3 py-2"
          >
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]",
                SEVERITY_STYLE[f.severity],
              )}
            >
              {f.severity}
            </span>
            <div className="text-[11.5px]">
              <div className="text-foreground">{f.message}</div>
              <div className="text-faint">Suspected cause: {f.suspected_cause}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function analyzeError(message: string): AnalysisReport {
  const m = message.toLowerCase();
  if (/offline|console|t3|ranging|lost/.test(m)) {
    return {
      summary: "The bed lost connectivity to the device during execution.",
      findings: [
        {
          severity: "critical",
          message: "Device console dropped mid-run (DOCSIS ranging / T3 timeout).",
          suspected_cause: "Bed offline or RF/console instability — retry on another bed.",
        },
      ],
    };
  }
  if (/timeout|timed out/.test(m)) {
    return {
      summary: "A step exceeded its time budget.",
      findings: [
        {
          severity: "major",
          message: "Operation timed out before the device reached the expected state.",
          suspected_cause: "Slow provisioning or an unresponsive service — check DHCP/ACS.",
        },
      ],
    };
  }
  return {
    summary: "The run failed. Review the failing step and console output below.",
    findings: [
      {
        severity: "major",
        message: message,
        suspected_cause: "See the boardfarm console for the failing assertion or trace.",
      },
    ],
  };
}

function StepDetail({ run, stepName }: { run: Run; stepName: string }) {
  const step = run.steps.find((s) => s.name === stepName)!;
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const artifactIds = useMemo(
    () => step.artifact_ids ?? [],
    [step.artifact_ids],
  );

  useEffect(() => {
    let active = true;
    Promise.all(artifactIds.map((id) => artifactsClient.get(id))).then(
      (results) => {
        if (active) setArtifacts(results.filter((a): a is Artifact => !!a));
      },
    );
    return () => {
      active = false;
    };
  }, [artifactIds]);

  const awaiting = step.state === "awaiting_approval";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[10px] border border-border bg-surface px-4 py-3.5">
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-accent" />
          <span className="text-[13px] font-medium text-foreground">
            {step.title}
          </span>
          {step.label && (
            <span className="rounded-full border border-border-strong px-2 py-0.5 text-[10.5px] text-faint">
              {step.label}
            </span>
          )}
          <span className="ml-auto font-mono text-[11px] text-faint">
            {step.state.replace("_", " ")}
          </span>
        </div>

        {/* Execution details for integration steps (e.g. the Jenkins build). */}
        {step.details && Object.keys(step.details).length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-inset px-3 py-2 font-mono text-[11.5px]">
            {Object.entries(step.details).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-faint">{k}</dt>
                <dd className="text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {artifacts.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            {artifacts.map((a) => (
              <div key={a.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full border border-border-strong px-2.5 py-0.5 font-mono text-[11.5px] text-muted">
                    {a.name}
                  </span>
                  <span className="text-[11px] text-faint">
                    v{a.version} · {a.status}
                  </span>
                </div>
                <CodeView code={a.content} language={a.language} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-faint">
            {step.state === "pending"
              ? "Not started yet."
              : awaiting
                ? "Review the previous steps' output, then decide below."
                : "No artifacts from this step."}
          </p>
        )}
      </div>

      {awaiting && (
        <div className="flex items-center gap-2.5">
          <Button variant="primary" onClick={() => void runsClient.approve(run.id)}>
            Approve and continue
          </Button>
          <Button variant="secondary" onClick={() => void runsClient.cancel(run.id)}>
            Request changes
          </Button>
          <span className="ml-auto text-[11.5px] text-faint">
            paused {fmtAgo(step.started_at ?? run.created_at)}
          </span>
        </div>
      )}
    </div>
  );
}
