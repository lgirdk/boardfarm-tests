import { useEffect, useMemo, useRef } from "react";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Run, RunStep } from "@/lib/contracts";

type Level = "info" | "ok" | "warn" | "err";
interface LogLine {
  ts: number;
  level: Level;
  text: string;
}

/**
 * The run console. In mock mode it reconstructs a plausible boardfarm transcript
 * from the run's steps so the execution UX is real; once the backend bridge is
 * connected this pane streams the actual boardfarm stdout instead. It never
 * fabricates status the run doesn't have — every line is derived from a step's
 * real state/summary/details.
 *
 * Console is ALWAYS dark regardless of theme — uses console-* CSS tokens.
 */
export function RunLogTerminal({ run }: { run: Run }) {
  const lines = useMemo(() => buildLines(run), [run]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  const live = run.status === "running" || run.status === "awaiting_approval";

  return (
    <div className="overflow-hidden rounded-[11px] border border-border">
      {/* Header bar */}
      <div className="console-panel flex items-center gap-2 border-b px-3 py-2">
        <Terminal className="h-3.5 w-3.5" style={{ color: "rgb(var(--console-src))" }} />
        <span className="font-mono text-[11.5px]" style={{ color: "rgb(var(--console-ts))" }}>
          boardfarm console
        </span>
        {live && (
          <span className="flex items-center gap-1 text-[10.5px] text-running">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-running" />
            streaming
          </span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: "rgb(var(--console-ts))" }}>
          simulated · real boardfarm output when the bridge is connected
        </span>
      </div>

      {/* Log output — always dark background */}
      <div
        className="console-panel max-h-[320px] overflow-auto px-3 py-2.5 font-mono text-[11.5px] leading-relaxed"
      >
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="console-ts shrink-0 select-none">{fmtClock(l.ts)}</span>
            <span className={cn("whitespace-pre-wrap", LEVEL_STYLE[l.level])}>{l.text}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <span style={{ color: "rgb(var(--console-ts))" }}>Waiting for output…</span>
        )}
        <div ref={endRef} />
      </div>

      {/* Interactive console hint — also dark */}
      <div className="console-panel flex items-center gap-2 border-t px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <span className="font-mono text-[11.5px]" style={{ color: "rgb(var(--console-src))" }}>›</span>
        <input
          disabled
          placeholder={
            live ? "attach to a device console…" : "console available on a reserved bed"
          }
          className="flex-1 bg-transparent font-mono text-[11.5px] outline-none placeholder:opacity-60"
          style={{ color: "rgb(var(--console-ts))" }}
        />
        <span
          className="rounded border px-1.5 py-0.5 text-[9.5px]"
          style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgb(var(--console-ts))" }}
        >
          read-only preview
        </span>
      </div>
    </div>
  );
}

const LEVEL_STYLE: Record<Level, string> = {
  info: "console-src",
  ok: "console-ok",
  warn: "console-warn",
  err: "console-err",
};

/** Boardfarm-flavored line templates per known step name. */
function stepLines(step: RunStep): { level: Level; text: string }[] {
  const out: { level: Level; text: string }[] = [];
  const running = step.state === "running";
  const done = step.state === "completed";
  const failed = step.state === "failed";

  const START: Record<string, string> = {
    reserve: "reserving a free bed from the pool…",
    flash: `flashing image${step.details?.image ? ` ${step.details.image}` : ""} (strategy=${step.details?.strategy ?? "all"})…`,
    provision: "booting device, waiting for DOCSIS ranging…",
    execute: "pytest-boardfarm3: session start",
    cleanup: "releasing bed and tearing down services…",
    "fetch-ticket": "pulling ticket from Jira…",
    generate: "codegen: reasoning → search → generation…",
    review: "waiting for human review…",
    "open-pr": "opening merge request…",
    analyze: "analyzing execution logs…",
    plan: "planning tests from scope…",
    report: "publishing report…",
  };

  out.push({ level: "info", text: `[${step.name}] ${START[step.name] ?? `${step.title}…`}` });

  if (step.name === "provision" && (done || running)) {
    out.push({ level: "info", text: "  DHCP DISCOVER → OFFER → REQUEST → ACK" });
    if (done) out.push({ level: "ok", text: "  eRouter online" });
  }
  if (step.name === "execute" && (done || failed)) {
    out.push({ level: "info", text: "  collected tests · running on bed" });
  }

  if (step.details) {
    for (const [k, v] of Object.entries(step.details)) {
      out.push({ level: "info", text: `  ${k}: ${v}` });
    }
  }

  if (done && step.summary) out.push({ level: "ok", text: `  ✓ ${step.summary}` });
  if (failed) out.push({ level: "err", text: `  ✗ ${step.summary ?? "step failed"}` });

  return out;
}

function buildLines(run: Run): LogLine[] {
  const lines: LogLine[] = [];
  const base = run.started_at ?? run.created_at;
  run.steps.forEach((step, i) => {
    if (step.state === "pending" || step.state === "skipped") return;
    const ts = step.started_at ?? base + i * 1500;
    for (const l of stepLines(step)) lines.push({ ts, level: l.level, text: l.text });
  });
  if (run.status === "completed") {
    lines.push({ ts: run.finished_at ?? Date.now(), level: "ok", text: "run completed" });
  }
  if (run.error) {
    lines.push({ ts: run.finished_at ?? Date.now(), level: "err", text: run.error.message });
  }
  return lines;
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
