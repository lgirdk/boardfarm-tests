import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/Button";
import { RecordForm } from "@/components/RecordForm";
import { validateRecord } from "@/lib/schema/toZod";
import { workflowsClient } from "@/lib/workflows";
import { runsClient } from "@/lib/runs";
import type { ConfigRecord } from "@/lib/schema/types";
import type { WorkflowDef } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * The pipeline input form — rendered from the workflow's input_descriptor via
 * the EXISTING FieldRenderer machinery (no second form engine). "Pause after
 * step" adds user-selected approval points on top of the workflow's gates.
 */
export function PipelineRunPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDef | null | undefined>();
  const [input, setInput] = useState<ConfigRecord>({});
  const [pauseAfter, setPauseAfter] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let active = true;
    if (!name) return;
    void workflowsClient.get(name).then((w) => active && setWorkflow(w));
    return () => {
      active = false;
    };
  }, [name]);

  const errors = useMemo(
    () => (workflow ? validateRecord(workflow.input_descriptor, input) : {}),
    [workflow, input],
  );
  const canRun = workflow !== null && Object.keys(errors).length === 0;

  if (workflow === undefined) {
    return <p className="px-6 py-8 text-sm text-faint">Loading pipeline…</p>;
  }
  if (workflow === null) {
    return (
      <p className="px-6 py-8 text-sm text-muted">
        No pipeline named <code className="font-mono">{name}</code>.
      </p>
    );
  }

  async function handleRun() {
    if (!canRun || submitting || !workflow) return;
    setTouched(true);
    setSubmitting(true);
    try {
      const run = await runsClient.trigger(workflow.name, input, {
        pauseAfter: pauseAfter.length ? pauseAfter : undefined,
      });
      navigate(`/runs/${run.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-faint">pipeline/</span>
        <span className="font-mono text-sm text-foreground">{workflow.name}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        {workflow.description}
      </p>

      <div className="mt-5 rounded-[10px] border border-border bg-surface p-4">
        <RecordForm
          fields={workflow.input_descriptor}
          record={input}
          errors={touched ? errors : {}}
          onChange={(key, value) => setInput({ ...input, [key]: value })}
        />

        <div className="mt-5 border-t border-border pt-4">
          <div className="text-[11px] tracking-[0.06em] text-faint">
            Pause after step
          </div>
          <p className="mt-1 text-[11.5px] text-muted">
            Extra approval points on top of the pipeline's own gates.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {workflow.steps.map((step) => {
              const on = pauseAfter.includes(step.name);
              return (
                <button
                  key={step.name}
                  onClick={() =>
                    setPauseAfter(
                      on
                        ? pauseAfter.filter((s) => s !== step.name)
                        : [...pauseAfter, step.name],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[11.5px] transition",
                    on
                      ? "border-accent/60 bg-accent/15 text-foreground"
                      : "border-border text-muted hover:border-border-strong",
                  )}
                >
                  {step.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          disabled={submitting || (touched && !canRun)}
          onClick={() => {
            setTouched(true);
            if (canRun) void handleRun();
          }}
        >
          <Play className="h-4 w-4" />
          {submitting ? "Starting…" : "Run pipeline"}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/pipelines")}>
          Back to pipelines
        </Button>
      </div>
    </div>
  );
}
