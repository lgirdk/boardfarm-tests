import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FileCode2, OctagonX } from "lucide-react";
import { Button } from "@/components/Button";
import { StatusChip } from "@/components/StatusChip";
import { CodeView } from "@/components/CodeView";
import { runsClient } from "@/lib/runs";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import { artifactsClient } from "@/lib/artifacts";
import { fmtAgo } from "@/lib/time";
import type { Artifact, Run } from "@/lib/contracts";
import { deriveRail, defaultFocusStep } from "./runRail";
import { RunRail } from "./RunRail";

/**
 * The signature screen: live run detail. Left, the vertical step rail; right,
 * the focused step's artifacts and — when awaiting approval — the approval bar.
 * Live-updates through runsClient.subscribe.
 */
export function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { run, notFound } = useRunSubscription(id);
  const [selectedStep, setSelectedStep] = useState<string | undefined>();

  // Follow the run's focus (current/awaiting/failed step) until the user
  // explicitly picks a step, then respect their choice.
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (run && !userPicked) setSelectedStep(defaultFocusStep(run));
  }, [run, userPicked]);

  if (notFound) {
    return (
      <div className="px-8 py-10 text-sm text-muted">
        No run with id <code className="font-mono">{id}</code>. It may have
        been created in a previous session — trigger a pipeline to see a live one.
      </div>
    );
  }
  if (!run) {
    return <div className="px-8 py-10 text-sm text-faint">Loading run…</div>;
  }

  const rail = deriveRail(run);
  const step = run.steps.find((s) => s.name === selectedStep);
  const terminal =
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "cancelled";

  return (
    <div className="px-6 py-5">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-xs text-faint">run/</span>
        <span className="font-mono text-sm text-foreground">
          {run.workflow} · #{run.id}
        </span>
        <StatusChip status={run.status} />
        <span className="ml-auto flex items-center gap-3 text-xs text-faint">
          workspace: {run.workspace}
          {!terminal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void runsClient.cancel(run.id)}
            >
              Cancel run
            </Button>
          )}
        </span>
      </div>

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

      <div className="mt-4 flex items-start gap-5">
        <div className="w-[210px] shrink-0 pt-1">
          <RunRail
            nodes={rail}
            selected={selectedStep}
            onSelect={(name) => {
              setSelectedStep(name);
              setUserPicked(true);
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {step ? (
            <StepDetail run={run} stepName={step.name} />
          ) : (
            <p className="py-6 text-sm text-faint">Select a step.</p>
          )}
        </div>
      </div>
    </div>
  );
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
