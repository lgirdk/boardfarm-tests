import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, FileJson, MapPin, Server, Upload, X } from "lucide-react";
import { bedsClient, parseStationFile } from "@/lib/beds";
import type { ImportResult } from "@/lib/beds";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [avail, setAvail] = useState<BoardTypeAvailability[]>([]);
  const [model, setModel] = useState<string | null>(null);

  // Import state
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    void bedsClient.list().then(setBeds);
    void bedsClient.availability().then(setAvail);
  }, []);

  useEffect(() => {
    let active = true;
    void bedsClient.list().then((b) => active && setBeds(b));
    void bedsClient.availability().then((a) => active && setAvail(a));
    return () => {
      active = false;
    };
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const result = parseStationFile(raw);
        setImportPreview(result);
      } catch {
        setImportPreview({ beds: [], models: new Map(), totalParsed: 0, skipped: ["Parse error: invalid JSON"] });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  async function confirmImport() {
    if (!importPreview || importPreview.totalParsed === 0) return;
    setImporting(true);
    await bedsClient.importInventory(importPreview.beds);
    setImporting(false);
    setImportDone(`Imported ${importPreview.totalParsed} boards`);
    setImportPreview(null);
    reload();
    setTimeout(() => setImportDone(null), 4000);
  }

  const visible = useMemo(
    () => (beds ?? []).filter((b) => !model || b.board_model === model),
    [beds, model],
  );

  return (
    <div className="min-h-full">
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Import preview overlay */}
      {importPreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--glass-veil)]">
          <div className="w-full max-w-lg rounded-[14px] border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Import preview</h3>
              <button onClick={() => setImportPreview(null)} className="text-faint hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {importPreview.totalParsed === 0 ? (
              <div className="mt-4 rounded-[9px] border border-danger/30 bg-danger/[0.06] px-3 py-3 text-[12.5px] text-danger">
                No valid boards found in this file.
                {importPreview.skipped.length > 0 && (
                  <div className="mt-1 text-[11px] text-muted">
                    Skipped: {importPreview.skipped.slice(0, 5).join(", ")}
                    {importPreview.skipped.length > 5 && ` +${importPreview.skipped.length - 5} more`}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mt-4 rounded-[9px] border border-ok/30 bg-ok/[0.06] px-3 py-3">
                  <div className="text-[13px] font-medium text-foreground">
                    Found {importPreview.totalParsed} boards
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...importPreview.models.entries()].map(([m, count]) => (
                      <span
                        key={m}
                        className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 font-mono text-[11.5px] text-foreground"
                      >
                        {m} <span className="text-muted">×{count}</span>
                      </span>
                    ))}
                  </div>
                  {importPreview.skipped.length > 0 && (
                    <div className="mt-2 text-[11px] text-faint">
                      Skipped {importPreview.skipped.length} non-board entries
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[11.5px] text-muted">
                  This will replace the current inventory. All boards will start as &quot;free&quot; — runtime
                  status (held, in use) is tracked separately by the application.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={importing}
                    onClick={() => void confirmImport()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {importing ? "Importing…" : `Import ${importPreview.totalParsed} boards`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success toast */}
      {importDone && (
        <div className="fixed bottom-6 left-1/2 z-[91] -translate-x-1/2 rounded-[10px] border border-ok/40 bg-ok/[0.12] px-4 py-2 text-[12.5px] font-medium text-ok shadow-lg">
          {importDone}
        </div>
      )}

      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-highlight" />
            <h1 className="text-lg font-semibold tracking-tight">Boards</h1>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-faint">
              read-only · lab inventory
            </span>
          </div>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <FileJson className="h-3.5 w-3.5" /> Import from JSON
            </Button>
          )}
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
