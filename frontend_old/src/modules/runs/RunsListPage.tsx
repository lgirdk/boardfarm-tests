import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusChip } from "@/components/StatusChip";
import { runsClient } from "@/lib/runs";
import { fmtAgo, runDuration } from "@/lib/time";
import type { Run, RunStatus } from "@/lib/contracts";
import { cn } from "@/lib/cn";

const POLL_MS = 2500;

/** Filter chips cover the full contract status enum. */
const ALL_STATUSES: RunStatus[] = [
  "queued",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
];

export function RunsListPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [filter, setFilter] = useState<RunStatus | null>(null);

  // Poll for liveness — non-terminal rows keep updating without a refresh.
  useEffect(() => {
    let active = true;
    const load = () =>
      void runsClient.list().then((r) => active && setRuns(r));
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const visible = runs?.filter((r) => !filter || r.status === filter) ?? null;

  return (
    <div className="px-6 py-6">
      <h1 className="text-lg font-semibold">Runs</h1>
      <p className="mt-0.5 text-xs text-muted">
        Every pipeline and app invocation, live.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <FilterChip
          label="all"
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {ALL_STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={s.replace("_", " ")}
            active={filter === s}
            onClick={() => setFilter(filter === s ? null : s)}
          />
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] tracking-[0.06em] text-faint">
              <th className="px-3.5 py-2 font-normal">run</th>
              <th className="px-3.5 py-2 font-normal">workflow</th>
              <th className="px-3.5 py-2 font-normal">status</th>
              <th className="px-3.5 py-2 font-normal">triggered by</th>
              <th className="px-3.5 py-2 font-normal">started</th>
              <th className="px-3.5 py-2 font-normal">duration</th>
            </tr>
          </thead>
          <tbody>
            {visible === null && (
              <tr>
                <td colSpan={6} className="px-3.5 py-6 text-center text-faint">
                  Loading runs…
                </td>
              </tr>
            )}
            {visible?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3.5 py-8 text-center text-faint">
                  No runs yet — trigger a pipeline to see it here.
                </td>
              </tr>
            )}
            {visible?.map((run) => (
              <tr
                key={run.id}
                onClick={() => navigate(`/runs/${run.id}`)}
                className="cursor-pointer border-b border-border/60 bg-surface/40 transition last:border-0 hover:bg-surface"
              >
                <td className="px-3.5 py-2.5 font-mono text-xs text-foreground">
                  #{run.id}
                </td>
                <td className="px-3.5 py-2.5 text-muted">{run.workflow_title}</td>
                <td className="px-3.5 py-2.5">
                  <StatusChip status={run.status} />
                </td>
                <td className="px-3.5 py-2.5 text-muted">{run.triggered_by}</td>
                <td className="px-3.5 py-2.5 text-faint">{fmtAgo(run.created_at)}</td>
                <td className="px-3.5 py-2.5 font-mono text-xs text-faint">
                  {runDuration(run)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11.5px] transition",
        active
          ? "border-accent/60 bg-accent/15 text-foreground"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
