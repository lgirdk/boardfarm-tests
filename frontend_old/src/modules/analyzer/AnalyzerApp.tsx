import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { JobProgress } from "@/components/JobProgress";
import { appsClient } from "@/lib/apps";
import { artifactsClient } from "@/lib/artifacts";
import { useAuth } from "@/lib/auth";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import type {
  AnalysisReport,
  Artifact,
  FindingSeverity,
} from "@/lib/contracts";
import { cn } from "@/lib/cn";

type Source = "paste" | "artifact";

/**
 * Log analyzer: paste logs or pick an execution artifact, run the analysis
 * job, review findings (severity, message, suspected cause) and a summary.
 */
export function AnalyzerApp() {
  const { user } = useAuth();
  const [source, setSource] = useState<Source>("paste");
  const [logs, setLogs] = useState("");
  const [artifactId, setArtifactId] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [runId, setRunId] = useState<string>();
  const { run } = useRunSubscription(runId);

  useEffect(() => {
    let active = true;
    void artifactsClient
      .list(user?.workspace.id ?? "docsis-team")
      .then((a) => active && setArtifacts(a));
    return () => {
      active = false;
    };
  }, [user]);

  const report =
    run?.status === "completed" && run.output?.report
      ? (run.output.report as AnalysisReport)
      : null;

  const canAnalyze =
    source === "paste" ? logs.trim() !== "" : artifactId !== "";
  const analyzing =
    run !== null && run.status !== "completed" && run.status !== "failed";

  async function handleAnalyze() {
    const job = await appsClient.analyzeLogs(
      source === "paste" ? { logs: logs.trim() } : { artifact_id: artifactId },
    );
    setRunId(job.run_id);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="text-lg font-semibold">Log analyzer</h1>
      <p className="mt-0.5 text-xs text-muted">
        Point it at an execution log; get findings with suspected causes.
      </p>

      <div className="mt-5 rounded-[10px] border border-border bg-surface p-4">
        <div className="flex gap-1.5">
          {(
            [
              ["paste", "Paste logs"],
              ["artifact", "Pick an artifact"],
            ] as [Source, string][]
          ).map(([s, label]) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition",
                source === s
                  ? "bg-accent/15 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {source === "paste" ? (
            <TextField
              label="Logs"
              required
              multiline
              rows={8}
              value={logs}
              onChange={setLogs}
              placeholder={"2024-… board: RNG-RSP received…\n2024-… board: T3 time-out…"}
            />
          ) : (
            <SelectField
              label="Execution artifact"
              required
              value={artifactId}
              onChange={setArtifactId}
              options={artifacts.map((a) => ({
                value: a.id,
                label: `${a.name} (${a.type})`,
              }))}
              placeholder="Pick an artifact…"
            />
          )}
        </div>

        <div className="mt-4">
          <Button
            variant="primary"
            disabled={!canAnalyze || analyzing}
            onClick={() => void handleAnalyze()}
          >
            <Play className="h-4 w-4" />
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
      </div>

      {run && !report && (
        <div className="mt-4">
          <JobProgress run={run} />
        </div>
      )}

      {report && (
        <div className="mt-6">
          <div className="rounded-[10px] border border-border bg-surface px-4 py-3.5">
            <div className="text-[13px] font-medium">Summary</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {report.summary}
            </p>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {report.findings.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-[10px] border border-border bg-surface px-4 py-3"
              >
                <SeverityChip severity={f.severity} />
                <div className="min-w-0">
                  <div className="text-[12.5px] text-foreground">{f.message}</div>
                  <div className="mt-1 text-[11.5px] leading-relaxed text-muted">
                    {f.suspected_cause}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  critical: "bg-danger/15 text-danger",
  major: "bg-warning/15 text-warning",
  minor: "bg-idle/20 text-muted",
};

function SeverityChip({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={cn(
        "mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[11px]",
        SEVERITY_STYLE[severity],
      )}
    >
      {severity}
    </span>
  );
}
