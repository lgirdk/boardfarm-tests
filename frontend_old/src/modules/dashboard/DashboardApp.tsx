import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusChip } from "@/components/StatusChip";
import { useRegistries } from "@/lib/registries";
import { runsClient } from "@/lib/runs";
import { artifactsClient } from "@/lib/artifacts";
import { useAuth } from "@/lib/auth";
import { fmtAgo } from "@/lib/time";
import type { Run } from "@/lib/contracts";

const POLL_MS = 2500;

/**
 * Platform overview: registry-driven stats, the last runs with live status,
 * and the runs waiting on the signed-in user. Everything comes from clients —
 * nothing static.
 */
export function DashboardApp() {
  const { registries, loading } = useRegistries();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      void runsClient.list().then((r) => active && setRuns(r));
      void artifactsClient
        .list(user?.workspace.id ?? "docsis-team", { status: "draft" })
        .then((a) => active && setDraftCount(a.length));
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user]);

  const recent = runs.slice(0, 5);
  const awaiting = runs.filter((r) => r.status === "awaiting_approval");

  const stats = [
    { label: "registered llms", value: loading ? "…" : String(registries.llm_clients.length) },
    { label: "pipeline stages", value: loading ? "…" : String(registries.codegen_stages.length) },
    { label: "draft artifacts", value: draftCount === null ? "…" : String(draftCount) },
    { label: "runs total", value: String(runs.length) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <p className="mt-0.5 text-xs text-muted">
        {user ? `Signed in as ${user.username} · ${user.workspace.name}` : "Platform overview"}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[10px] border border-border bg-surface p-3.5">
            <div className="font-mono text-xl text-foreground">{s.value}</div>
            <div className="mt-1 text-[11px] tracking-[0.06em] text-faint">{s.label}</div>
          </div>
        ))}
      </div>

      {awaiting.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] tracking-[0.06em] text-faint">
            Waiting on you
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {awaiting.map((run) => (
              <button
                key={run.id}
                onClick={() => navigate(`/runs/${run.id}`)}
                className="flex items-center gap-3 rounded-[10px] border border-warning/30 bg-warning/5 px-4 py-2.5 text-left transition hover:border-warning/50"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning halo-wait" />
                <span className="font-mono text-xs text-foreground">#{run.id}</span>
                <span className="text-xs text-muted">{run.workflow_title}</span>
                <span className="ml-auto text-[11px] text-faint">
                  paused at {run.current_step ?? "—"} · {fmtAgo(run.created_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] tracking-[0.06em] text-faint">Recent runs</div>
          <Link to="/runs" className="text-[11.5px] text-accent hover:underline">
            All runs
          </Link>
        </div>
        <div className="mt-2 overflow-hidden rounded-[10px] border border-border">
          {recent.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-faint">
              No runs yet — trigger a pipeline to see it here.
            </p>
          )}
          {recent.map((run) => (
            <button
              key={run.id}
              onClick={() => navigate(`/runs/${run.id}`)}
              className="flex w-full items-center gap-3 border-b border-border/60 bg-surface/40 px-4 py-2.5 text-left transition last:border-0 hover:bg-surface"
            >
              <span className="font-mono text-xs text-foreground">#{run.id}</span>
              <span className="text-xs text-muted">{run.workflow_title}</span>
              <StatusChip status={run.status} className="ml-auto" />
              <span className="w-16 text-right text-[11px] text-faint">
                {fmtAgo(run.created_at)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
