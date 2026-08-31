import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ScanText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { analyzerClient } from "@/lib/analyzer";
import type {
  AnalyzerAction,
  AnalyzerActionKind,
  EvidenceLevel,
  LogAnalysis,
  PastRunLog,
} from "@/lib/contracts";

type Mode = "paste" | "run" | "upload";

const LEVEL: Record<EvidenceLevel, string> = {
  info: "text-[#7F8B99]",
  ok: "text-ok",
  warn: "text-warning",
  err: "text-danger",
};
const SEV_CARD: Record<LogAnalysis["severity"], string> = {
  critical: "border-danger/40 bg-danger/[0.05]",
  major: "border-warning/40 bg-warning/[0.05]",
  minor: "border-border bg-surface/40",
};
const SEV_CHIP: Record<LogAnalysis["severity"], string> = {
  critical: "bg-danger/15 text-danger",
  major: "bg-warning/15 text-warning",
  minor: "bg-idle/20 text-muted",
};

const ACTION_ROUTE: Partial<Record<AnalyzerActionKind, string>> = {
  open_environment: "/environments",
  open_board: "/boards",
};

/**
 * Log analyzer — the same engine that annotates a failed run inline, run
 * standalone against any log you paste, a past run's output, or a dropped file.
 */
export function AnalyzerApp() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [pastRuns, setPastRuns] = useState<PastRunLog[]>([]);
  const [result, setResult] = useState<LogAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    void analyzerClient.sampleLog().then(setText);
    void analyzerClient.pastRuns().then(setPastRuns);
  }, []);

  async function analyze() {
    setAnalyzing(true);
    setResult(await analyzerClient.analyze(text));
    setAnalyzing(false);
  }

  function runAction(a: AnalyzerAction) {
    const route = a.kind ? ACTION_ROUTE[a.kind] : undefined;
    if (route) navigate(route);
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <ScanText className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Log analyzer</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Paste boardfarm output, pick a past run, or drop a file — the same engine that
          annotates failed runs points at the likely cause, ranked by severity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-2">
        {/* input */}
        <div className="rounded-[12px] border border-border bg-surface/40 p-4">
          <div className="mb-3 flex gap-1 rounded-[9px] border border-border bg-surface-raised p-0.5">
            {(["paste", "run", "upload"] as Mode[]).map((mo) => (
              <button
                key={mo}
                onClick={() => setMode(mo)}
                className={cn(
                  "flex-1 rounded-[7px] py-1.5 text-[12px] transition",
                  mode === mo
                    ? "bg-surface text-foreground shadow"
                    : "text-muted hover:text-foreground",
                )}
              >
                {mo === "paste" ? "Paste a log" : mo === "run" ? "From a past run" : "Upload file"}
              </button>
            ))}
          </div>

          {mode === "paste" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder="Paste boardfarm output…"
              className="w-full rounded-[9px] border border-border bg-surface-inset px-3 py-2 font-mono text-[11.5px] leading-[1.7] text-foreground outline-none focus:border-accent/60"
            />
          )}

          {mode === "run" && (
            <div className="space-y-2">
              {pastRuns.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setText(r.log);
                    setResult(null);
                    setMode("paste");
                  }}
                  className="flex w-full items-center justify-between rounded-[9px] border border-border bg-surface px-3 py-2.5 text-left transition hover:border-border-strong"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] text-foreground">{r.id}</div>
                    <div className="truncate text-[11px] text-faint">{r.what}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-highlight">load →</span>
                </button>
              ))}
              <p className="text-[11px] text-faint">
                Pick a failed run to pull its console output in, then analyze.
              </p>
            </div>
          )}

          {mode === "upload" && (
            <label className="grid h-[248px] cursor-pointer place-content-center rounded-[9px] border border-dashed border-border text-center transition hover:border-border-strong">
              <Upload className="mx-auto h-5 w-5 text-faint" />
              <div className="mt-2 text-[12px] text-muted">Drop a .log file, or click to choose</div>
              <div className="mt-0.5 text-[11px] text-faint">
                Stays in your browser — nothing is uploaded.
              </div>
              <input
                type="file"
                accept=".log,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void f.text().then((t) => {
                      setText(t);
                      setMode("paste");
                    });
                }}
              />
            </label>
          )}

          <Button
            variant="primary"
            className="mt-3 w-full justify-center"
            disabled={!text.trim() || analyzing}
            onClick={() => void analyze()}
          >
            <Sparkles className="h-4 w-4" /> {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </div>

        {/* result */}
        <div>
          {!result ? (
            <div className="grid h-[360px] place-content-center rounded-[12px] border border-border bg-surface/40 text-center">
              <p className="text-[13px] text-muted">Findings appear here, ranked by severity.</p>
              <p className="mt-1 text-[11px] text-faint">The same engine that annotates failed runs.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={cn("rounded-[12px] border p-4", SEV_CARD[result.severity])}>
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4",
                      result.severity === "critical" ? "text-danger" : "text-warning",
                    )}
                  />
                  <span className="text-[13px] font-semibold">{result.headline}</span>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[10.5px]",
                      SEV_CHIP[result.severity],
                    )}
                  >
                    {result.severity}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-muted">{result.detail}</p>

                {result.evidence.length > 0 && (
                  <>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.05em] text-faint">
                      Evidence
                    </div>
                    <div className="mt-1.5 overflow-auto rounded-[9px] border border-border bg-surface-inset px-3 py-2 font-mono text-[11px] leading-[1.7]">
                      {result.evidence.map((e, i) => (
                        <div key={i} className="flex gap-2.5">
                          <span className="shrink-0 select-none text-faint">{e.ts}</span>
                          <span className="w-[72px] shrink-0 select-none text-accent">{e.src}</span>
                          <span className={cn("whitespace-pre-wrap", LEVEL[e.level])}>{e.text}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-3 text-[10px] uppercase tracking-[0.05em] text-faint">
                  Likely cause
                </div>
                <p className="mt-1 text-[12px] text-muted">{result.likely_cause}</p>

                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {result.actions.map((a, i) => (
                    <Button
                      key={i}
                      variant="secondary"
                      size="sm"
                      onClick={() => runAction(a)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="border-l-2 border-accent pl-2.5 text-[11.5px] text-muted">
                This is the same analyzer that annotates a failed run inline — here it runs
                standalone against any log you paste.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
