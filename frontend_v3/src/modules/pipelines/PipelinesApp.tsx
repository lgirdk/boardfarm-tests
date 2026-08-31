import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Play, Workflow } from "lucide-react";
import { Button } from "@/components/Button";
import { workflowsClient } from "@/lib/workflows";
import type { WorkflowDef } from "@/lib/contracts";

/**
 * Pipeline catalog — a card per workflow from WorkflowsClient.list(). The step
 * trail is a mini horizontal preview; gateway steps are marked amber (they
 * pause for approval).
 */
export function PipelinesApp() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowDef[] | null>(null);

  useEffect(() => {
    let active = true;
    // "test-run" is the execution primitive behind Start-a-run, not a pipeline.
    void workflowsClient
      .list()
      .then((w) => active && setWorkflows(w.filter((x) => x.name !== "test-run")));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Pipelines</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Multi-step automation with approval gates: ticket → generate → review → PR →
          run → analyze. Run one and watch it in Runs.
        </p>
      </div>

      <div className="px-6 py-5">
        {workflows === null && (
          <p className="text-sm text-faint">Loading pipelines…</p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {workflows?.map((wf) => (
            <div
              key={wf.name}
              className="flex flex-col rounded-[12px] border border-border bg-surface/40 p-4 transition hover:border-border-strong"
            >
              <div className="font-mono text-[13px] text-foreground">{wf.name}</div>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted">
                {wf.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-1">
                {wf.steps.map((step, i) => (
                  <span key={step.name} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-faint" />}
                    <span
                      className={
                        "font-mono text-[11px] " +
                        (step.approval ? "text-warning" : "text-faint")
                      }
                      title={step.approval ? `${step.title} — approval gate` : step.title}
                    >
                      {step.name}
                    </span>
                  </span>
                ))}
              </div>

              <div className="mt-4">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/pipelines/${wf.name}`)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run pipeline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
