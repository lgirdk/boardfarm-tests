import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Play } from "lucide-react";
import { schedulesClient } from "@/lib/schedules";
import { StatusChip } from "@/components/StatusChip";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import type { Schedule } from "@/lib/contracts";

/**
 * Schedules — a saved run setup with a clock. Same tests, same environment,
 * same board rules, just unattended. A schedule stores a fully resolved RunSpec,
 * so it never needs the composer at fire time.
 */
export function SchedulesApp() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void schedulesClient.list().then(setSchedules);
  }, []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  function toggle(s: Schedule) {
    void schedulesClient.setEnabled(s.id, !s.enabled);
    setSchedules((prev) =>
      (prev ?? []).map((x) =>
        x.id === s.id
          ? { ...x, enabled: !x.enabled, next: !x.enabled ? "recomputing…" : "paused" }
          : x,
      ),
    );
    flash(`${s.enabled ? "Paused" : "Resumed"} ${s.name}`);
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Schedules</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          A schedule is a saved run setup with a clock attached — same tests, environment and
          board rules, run unattended.
        </p>
      </div>

      <div className="space-y-3 px-6 py-6">
        {schedules === null && <p className="text-sm text-faint">Loading schedules…</p>}
        {schedules?.map((s) => (
          <div key={s.id} className="rounded-[12px] border border-border bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(s)}
                  role="switch"
                  aria-checked={s.enabled}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full border transition",
                    s.enabled ? "border-accent bg-accent/30" : "border-border bg-surface-raised",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
                      s.enabled ? "left-4 bg-accent" : "left-0.5 bg-faint",
                    )}
                  />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-medium">{s.name}</span>
                    {!s.enabled && (
                      <span className="rounded-full bg-idle/20 px-2 py-0.5 text-[10px] text-faint">
                        paused
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-faint">{s.what}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => navigate("/runs/r-0140")}>
                  Last result
                </Button>
                <Button variant="secondary" size="sm" onClick={() => flash("Running now, off-schedule")}>
                  <Play className="h-3.5 w-3.5" /> Run now
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="When">
                <div className="text-[12px]">{s.human}</div>
                <div className="font-mono text-[10.5px] text-faint">{s.cron}</div>
              </Field>
              <Field label="Board">
                <div className="text-[12px]">{s.board}</div>
              </Field>
              <Field label="Environment">
                <div className="font-mono text-[11px] text-muted">{s.env}</div>
              </Field>
              <Field label="Next / last">
                <div className="text-[12px]">{s.next}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <StatusChip status={s.last_state} />
                  <span className="text-[10.5px] text-faint">{s.last}</span>
                </div>
              </Field>
            </div>
          </div>
        ))}
        <p className="border-l-2 border-accent pl-2.5 text-[11.5px] text-muted">
          A schedule that keeps failing on the same bed tells you here, rather than quietly
          filling Runs with red.
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[9px] border border-border-strong bg-surface-raised px-4 py-2 text-[12px] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] uppercase tracking-[0.05em] text-faint">{label}</div>
      {children}
    </div>
  );
}
