import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Play } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import { Button } from "@/components/Button";
import { runsClient } from "@/lib/runs";
import { bedsClient } from "@/lib/beds";
import { testsClient } from "@/lib/tests";
import { useAuth } from "@/lib/auth";
import { fmtAgo, runDuration } from "@/lib/time";
import { testHealth } from "@/lib/testHealth";
import { cn } from "@/lib/cn";
import type { ActivityItem, Bed, BoardTypeAvailability, Run, TestAsset } from "@/lib/contracts";
import { activityClient } from "@/lib/activity";

const POLL_MS = 2500;

/**
 * Overview — the Monday-morning briefing: what needs me, what's running, did the
 * nightly pass. Right rail: bed pool, flaky tests, team activity. All live from
 * clients; nothing static.
 */
export function DashboardApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Run[]>([]);
  const [avail, setAvail] = useState<BoardTypeAvailability[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [tests, setTests] = useState<TestAsset[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => void runsClient.list().then((r) => active && setRuns(r));
    load();
    void bedsClient.availability().then((a) => active && setAvail(a));
    void bedsClient.list().then((b) => active && setBeds(b));
    void testsClient.list().then((t) => active && setTests(t));
    void activityClient.teamActivity().then((a) => active && setActivity(a));
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const gates = runs.filter((r) => r.status === "awaiting_approval");
  const running = runs.filter((r) => r.status === "running");
  const recent = runs.slice(0, 5);
  const nightly = runs.find((r) => r.workflow === "nightly-sanity");
  const flaky = useMemo(() => tests.filter((t) => testHealth(t.id).flaky), [tests]);
  const held = beds.filter((b) => b.held_by && b.held_by !== "you");
  const freeBeds = avail.reduce((n, a) => n + a.free, 0);
  const totalBeds = avail.reduce((n, a) => n + a.total, 0);

  const firstName = (user?.display_name ?? user?.username ?? "there").split(" ")[0];
  const now = new Date();
  const part = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      {/* greeting */}
      <div className="glow-ambient border-b border-border px-6 pt-7 pb-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Good {part}, {firstName}
            </h1>
            <p className="mt-1 text-xs text-muted">
              {date} · {user?.workspace?.name ?? "workspace"} · {freeBeds} of {totalBeds} boards
              free right now
            </p>
          </div>
          <Link to="/runs/new">
            <Button variant="primary" size="sm">
              <Play className="h-3.5 w-3.5" /> Start a run
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* what needs me */}
        {gates.length > 0 && (
          <div className="mb-5 rounded-[11px] border border-warning/40 bg-warning/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <b className="text-[13px]">
                  {gates.length} run{gates.length > 1 ? "s are" : " is"} waiting on your approval
                </b>
              </div>
              <Link to="/runs" className="text-[11.5px] text-highlight hover:underline">
                Review all
              </Link>
            </div>
            <div className="mt-2 space-y-1">
              {gates.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/runs/${g.id}`)}
                  className="flex w-full items-center gap-2 text-left text-[12px] text-muted transition hover:text-foreground"
                >
                  <span className="font-mono text-faint">#{g.id}</span>
                  <span>{g.workflow_title}</span>
                  <span className="ml-auto text-[10.5px] text-faint">paused {fmtAgo(g.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* left */}
          <div className="space-y-6">
            <section>
              <SectionLabel>Running now</SectionLabel>
              <div className="mt-2 space-y-2.5">
                {running.length === 0 && (
                  <div className="rounded-[11px] border border-border bg-surface/40 px-4 py-6 text-center">
                    <p className="text-xs text-faint">Nothing running.</p>
                    <Link to="/library" className="mt-2 inline-block">
                      <Button variant="secondary" size="sm">
                        Pick tests to run
                      </Button>
                    </Link>
                  </div>
                )}
                {running.map((r) => (
                  <RunningCard key={r.id} run={r} onClick={() => navigate(`/runs/${r.id}`)} />
                ))}
              </div>
            </section>

            {nightly && (
              <section>
                <div className="flex items-baseline justify-between">
                  <SectionLabel>Last night&apos;s schedule</SectionLabel>
                  <Link to="/runs" className="text-[11.5px] text-highlight hover:underline">
                    All runs
                  </Link>
                </div>
                <div className="mt-2 rounded-[11px] border border-border bg-surface/40 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[12.5px]">
                      <span className="font-mono font-medium">nightly-sanity</span>
                      <span className="text-faint">
                        {" "}
                        · {String(nightly.input?.bed ?? nightly.workspace)}
                      </span>
                    </div>
                    <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] text-danger">
                      1 failed
                    </span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-6 flex-1 rounded-[4px] border",
                          i === 7 ? "border-danger/50 bg-danger/20" : "border-ok/30 bg-ok/15",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11.5px]">
                    <span className="text-muted">
                      11 passed · 1 failed —{" "}
                      <span className="font-mono">{flaky[0]?.name ?? "test_tr069_periodic_inform"}</span>
                    </span>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/runs/${nightly.id}`)}>
                        Inspect
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => navigate("/runs/new")}>
                        Re-run failed
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section>
              <div className="flex items-baseline justify-between">
                <SectionLabel>Recent activity</SectionLabel>
                <Link to="/runs" className="text-[11.5px] text-highlight hover:underline">
                  All runs
                </Link>
              </div>
              <div className="mt-2 overflow-hidden rounded-[11px] border border-border">
                {recent.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => navigate(`/runs/${run.id}`)}
                    className="flex w-full items-center gap-3 border-b border-border/60 bg-surface/40 px-4 py-2.5 text-left transition last:border-0 hover:bg-surface"
                  >
                    <span className="font-mono text-xs text-foreground">#{run.id}</span>
                    <span className="truncate text-xs text-muted">{run.workflow_title}</span>
                    <StatusChip status={run.status} className="ml-auto shrink-0" />
                    <span className="w-14 shrink-0 text-right text-[11px] text-faint">
                      {fmtAgo(run.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* right rail */}
          <div className="space-y-6">
            <section>
              <div className="flex items-baseline justify-between">
                <SectionLabel>Board pool</SectionLabel>
                <Link to="/boards" className="text-[11.5px] text-highlight hover:underline">
                  Board map
                </Link>
              </div>
              <div className="mt-2 space-y-2.5 rounded-[11px] border border-border bg-surface/40 p-3.5">
                {avail.length === 0 && <p className="py-2 text-center text-xs text-faint">Loading…</p>}
                {avail.map((a) => (
                  <div key={a.board_model}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px]">{a.board_model}</span>
                      <span className={cn("text-[11px]", a.free ? "text-ok" : "text-faint")}>
                        {a.free} free
                      </span>
                    </div>
                    <PoolBar a={a} />
                    <div className="mt-1 text-[10px] text-faint">
                      {a.in_use} running · {a.offline} offline
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Needs attention</SectionLabel>
              <div className="mt-2 rounded-[11px] border border-border bg-surface/40 p-3.5">
                <p className="text-[11.5px] text-muted">
                  {flaky.length} tests failed at least once recently.
                </p>
                <div className="mt-2 space-y-1.5">
                  {flaky.slice(0, 4).map((t) => (
                    <Link key={t.id} to="/library" className="flex items-center justify-between">
                      <span className="truncate font-mono text-[11px] text-muted">{t.name}</span>
                      <Spark id={t.id} />
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <SectionLabel>Team</SectionLabel>
              <div className="mt-2 space-y-1.5 rounded-[11px] border border-border bg-surface/40 p-3.5 text-[12px] text-muted">
                {held.slice(0, 3).map((b) => (
                  <div key={b.id}>
                    <b className="text-foreground">{b.held_by}</b> holds{" "}
                    <span className="font-mono text-[11px]">{b.id}</span>
                  </div>
                ))}
                {activity.map((a, i) => (
                  <div key={i}>
                    <b className="text-foreground">{a.actor}</b> {a.verb}{" "}
                    {a.target && <span className="font-mono text-[11px]">{a.target}</span>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.06em] text-faint">{children}</div>
  );
}

function RunningCard({ run, onClick }: { run: Run; onClick: () => void }) {
  const names = (run.input?.test_names as string[] | undefined) ?? [];
  const title =
    run.workflow === "test-run"
      ? names.length === 1
        ? names[0]
        : `${names.length || run.input?.test_count || 0} tests`
      : run.workflow_title;
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[11px] border border-border bg-surface/50 p-3.5 text-left transition hover:border-border-strong"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse-dot rounded-full bg-running" />
        <span className="truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="font-mono text-[10.5px] text-faint">#{run.id}</span>
        <span className="ml-auto text-[11px] text-muted">{runDuration(run)} elapsed</span>
      </div>
      <div className="mt-2.5 flex gap-1">
        {run.steps.slice(0, 7).map((s) => (
          <div
            key={s.name}
            className={cn(
              "relative min-w-0 flex-1 overflow-hidden rounded-[6px] border px-1.5 py-1",
              s.state === "completed"
                ? "border-ok/30"
                : s.state === "running"
                  ? "border-running/45 bg-running/5"
                  : "border-border",
            )}
          >
            <div
              className={cn(
                "truncate text-[9.5px]",
                s.state === "running"
                  ? "font-semibold text-running"
                  : s.state === "completed"
                    ? "text-muted"
                    : "text-faint",
              )}
            >
              {s.name.replace("_", " ")}
            </div>
            {s.state === "running" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 w-1/2 bg-running" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px] text-faint">
        {String(run.input?.bed ?? "—")} · started by {run.triggered_by}
      </div>
    </button>
  );
}

function PoolBar({ a }: { a: BoardTypeAvailability }) {
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={cn("block h-full", cls)} style={{ flex: n }} /> : null;
  return (
    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-idle">
      {seg(a.free, "bg-ok")}
      {seg(a.in_use, "bg-running")}
      {seg(a.offline, "bg-danger/50")}
    </div>
  );
}

function Spark({ id }: { id: string }) {
  const h = testHealth(id);
  return (
    <span className="flex items-center gap-0.5">
      {h.history.map((pass, i) => (
        <span key={i} className={cn("h-3 w-1 rounded-full", pass ? "bg-ok" : "bg-danger")} />
      ))}
    </span>
  );
}
