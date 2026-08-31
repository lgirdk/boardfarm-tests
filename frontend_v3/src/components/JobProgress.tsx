import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { StatusChip } from "./StatusChip";
import type { Run } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * Compact progress panel for app-style jobs (codegen / planner / analyzer):
 * status chip + a mini step trail + a link to the full run detail.
 */
export function JobProgress({ run }: { run: Run }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2.5">
        <StatusChip status={run.status} />
        <span className="font-mono text-xs text-faint">#{run.id}</span>
        <Link
          to={`/runs/${run.id}`}
          className="ml-auto text-[11.5px] text-accent hover:underline"
        >
          View run
        </Link>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {run.steps.map((step, i) => (
          <span key={step.name} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-faint" />}
            <span
              className={cn(
                "font-mono text-[11px]",
                step.state === "completed" && "text-ok",
                step.state === "running" && "text-running animate-pulse-dot",
                step.state === "failed" && "text-danger",
                step.state === "awaiting_approval" && "text-warning",
                (step.state === "pending" || step.state === "skipped") &&
                  "text-faint",
              )}
            >
              {step.name}
            </span>
          </span>
        ))}
      </div>
      {run.error && (
        <p className="mt-2 text-[11.5px] text-danger">{run.error.message}</p>
      )}
    </div>
  );
}
