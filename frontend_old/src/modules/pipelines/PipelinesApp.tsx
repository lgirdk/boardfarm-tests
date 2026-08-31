import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Play } from "lucide-react";
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
    void workflowsClient.list().then((w) => active && setWorkflows(w));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="px-6 py-6">
      <h1 className="text-lg font-semibold">Pipelines</h1>
      <p className="mt-0.5 text-xs text-muted">
        Multi-step workflows with approval gates. Run one to watch it in Runs.
      </p>

      {workflows === null && (
        <p className="mt-6 text-sm text-faint">Loading pipelines…</p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {workflows?.map((wf) => (
          <div
            key={wf.name}
            className="flex flex-col rounded-[10px] border border-border bg-surface p-4"
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
  );
}
