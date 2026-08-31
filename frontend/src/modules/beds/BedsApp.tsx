import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, MapPin, Server } from "lucide-react";
import { bedsClient } from "@/lib/beds";
import { cn } from "@/lib/cn";
import type { Bed, BedStatus, BoardTypeAvailability } from "@/lib/contracts";

const STATUS_STYLE: Record<BedStatus, string> = {
  free: "border-ok/30 bg-ok/10 text-ok",
  in_use: "border-running/30 bg-running/10 text-running",
  offline: "border-border bg-surface-raised text-faint",
  maintenance: "border-warning/30 bg-warning/10 text-warning",
};

const STATUS_LABEL: Record<BedStatus, string> = {
  free: "free",
  in_use: "in use",
  offline: "offline",
  maintenance: "maintenance",
};

/**
 * Beds — read-only view of the physical lab inventory. Users don't configure
 * beds; they see which board types have free beds and who holds the busy ones.
 * Picking a board TYPE happens in the run setup; boardfarm reserves the bed.
 */
export function BedsApp() {
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [avail, setAvail] = useState<BoardTypeAvailability[]>([]);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void bedsClient.list().then((b) => active && setBeds(b));
    void bedsClient.availability().then((a) => active && setAvail(a));
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => (beds ?? []).filter((b) => !model || b.board_model === model),
    [beds, model],
  );

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Boards</h1>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-faint">
            read-only · lab inventory
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Physical device boards and their live status. Pick a board type when you start
          a run — boardfarm reserves a free board from the pool.
        </p>

        {/* availability rollup */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {avail.map((a) => {
            const active = model === a.board_model;
            return (
              <button
                key={a.board_model}
                onClick={() => setModel(active ? null : a.board_model)}
                className={cn(
                  "rounded-[11px] border p-3 text-left transition",
                  active
                    ? "border-accent/50 bg-accent/[0.07]"
                    : "border-border bg-surface/40 hover:border-border-strong",
                )}
              >
                <div className="font-mono text-[12px] text-foreground">{a.board_model}</div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      a.free > 0 ? "text-ok" : "text-faint",
                    )}
                  >
                    {a.free}
                  </span>
                  <span className="text-[11px] text-faint">/ {a.total} free</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.features.slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-border px-1.5 py-px text-[9.5px] text-muted"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* bed table */}
      <div className="px-6 py-5">
        {beds === null && <p className="text-sm text-faint">Loading inventory…</p>}
        <div className="overflow-hidden rounded-[11px] border border-border">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface/60 text-[11px] uppercase tracking-[0.05em] text-faint">
                <th className="py-2 pl-3.5 font-medium">Board</th>
                <th className="py-2 pr-3 font-medium">Location</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="hidden py-2 pr-3 font-medium md:table-cell">Devices</th>
                <th className="py-2 pr-3 font-medium">Features</th>
                <th className="py-2 pr-3.5 font-medium">Held by</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id} className="border-t border-border/60 hover:bg-surface/50">
                  <td className="py-2.5 pl-3.5">
                    <div className="flex items-center gap-1.5 font-mono text-[12px] text-foreground">
                      <Server className="h-3 w-3 text-faint" />
                      {b.id}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1 text-[11.5px] text-muted">
                      <MapPin className="h-3 w-3 text-faint" />
                      {b.location}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        STATUS_STYLE[b.status],
                      )}
                    >
                      {STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td className="hidden py-2.5 pr-3 md:table-cell">
                    <span className="font-mono text-[10.5px] text-faint">
                      {b.devices.join(", ")}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {b.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-border px-1.5 py-px text-[10px] text-muted"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3.5">
                    {b.held_by ? (
                      <span className="text-[11.5px] text-muted">
                        {b.held_by}
                        {b.held_run_id && (
                          <Link
                            to={`/runs/${b.held_run_id}`}
                            className="ml-1 font-mono text-highlight hover:underline"
                          >
                            #{b.held_run_id}
                          </Link>
                        )}
                      </span>
                    ) : (
                      <span className="text-[11px] text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
