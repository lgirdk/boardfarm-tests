import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Lock, Play, Plus, Save, Sparkles, Trash2, Users, X } from "lucide-react";
import { suitesClient } from "@/lib/suites";
import { testsClient } from "@/lib/tests";
import { fmtAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { SlideOver } from "@/components/SlideOver";
import { useWorkbench } from "@/lib/workbench";
import { appsClient } from "@/lib/apps";
import type { JiraPlanResolution, TestAsset, TestSuite } from "@/lib/contracts";

/** Named collections of tests: build one from the selection, run it as one job. */
export function SuitesTab() {
  const { selected, runTests } = useWorkbench();
  const navigate = useNavigate();
  const [suites, setSuites] = useState<TestSuite[] | null>(null);
  const [tests, setTests] = useState<TestAsset[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [planKey, setPlanKey] = useState("MVX-R22-EXIT");
  const [plan, setPlan] = useState<JiraPlanResolution | null>(null);

  useEffect(() => {
    let active = true;
    void suitesClient.list().then((s) => active && setSuites(s));
    void testsClient.list().then((t) => active && setTests(t));
    return () => {
      active = false;
    };
  }, []);

  // Adopt the current tray selection into the draft builder.
  useEffect(() => {
    if (selected.length > 0)
      setDraftIds((prev) => [...new Set([...prev, ...selected.map((t) => t.id)])]);
  }, [selected]);

  // Resolve the Jira plan when the import drawer opens (read-only preview).
  useEffect(() => {
    if (importing) void appsClient.resolveJiraPlan(planKey).then(setPlan);
  }, [importing, planKey]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tests) m.set(t.id, t.name);
    return m;
  }, [tests]);

  async function save() {
    const name = draftName.trim();
    if (!name || draftIds.length === 0) return;
    const suite: TestSuite = {
      id: `suite-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      test_ids: draftIds,
      owner: "you",
      visibility: "private",
      updated_at: Date.now(),
    };
    const saved = await suitesClient.save(suite);
    setSuites((prev) => [saved, ...(prev ?? []).filter((s) => s.id !== saved.id)]);
    setDraftName("");
    setDraftIds([]);
  }

  async function remove(id: string) {
    await suitesClient.remove(id);
    setSuites((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  function runSuite(s: TestSuite) {
    runTests(tests.filter((t) => s.test_ids.includes(t.id)));
  }

  async function importPlan() {
    const matched = (plan?.issues ?? []).map((r) => r.test).filter(Boolean) as string[];
    const ids = tests.filter((t) => matched.includes(t.name)).map((t) => t.id);
    const suite: TestSuite = {
      id: "suite-mvx-r22-exit",
      name: "mvx-r22-exit",
      test_ids: ids,
      owner: "you",
      visibility: "private",
      updated_at: Date.now(),
    };
    const saved = await suitesClient.save(suite);
    setSuites((prev) => [saved, ...(prev ?? []).filter((s) => s.id !== saved.id)]);
    setImporting(false);
  }

  const building = draftIds.length > 0 || draftName.length > 0;
  const planMatched = (plan?.issues ?? []).filter((i) => i.test).length;

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted">
          A suite is a named set of tests in git. Build one from the library, or import a Jira
          test plan.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setImporting(true)}>
            Import a Jira test plan
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate("/library")}>
            <Plus className="h-3.5 w-3.5" /> Build one from the library
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-[12px] border border-dashed border-border p-3.5">
        <div className="text-[12.5px]">
          Suites usually aren&apos;t designed — they accumulate.
        </div>
        <div className="mt-1 text-[11px] text-faint">
          You ran the same three tests a few times this week. Any finished run can be saved as a
          suite in one click.
        </div>
      </div>

      {/* builder */}
      <div className="rounded-[12px] border border-border bg-surface/40 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent" />
          <h2 className="text-[13px] font-semibold">New suite</h2>
          <span className="text-[11px] text-faint">
            Select tests in the Tests tab, then name and save them here.
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Suite name, e.g. nightly-wan"
            className="min-w-[220px] flex-1 rounded-[9px] border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-foreground outline-none transition placeholder:text-faint focus:border-accent/60"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={!draftName.trim() || draftIds.length === 0}
          >
            <Save className="h-3.5 w-3.5" />
            Save suite
          </Button>
        </div>

        {building && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {draftIds.length === 0 && (
              <span className="text-[11.5px] text-faint">No tests picked yet.</span>
            )}
            {draftIds.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] text-muted"
              >
                {nameById.get(id) ?? id.split("/").pop()}
                <button
                  onClick={() => setDraftIds((prev) => prev.filter((x) => x !== id))}
                  className="text-faint hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* existing suites */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {suites?.map((s) => (
          <div
            key={s.id}
            className="rounded-[12px] border border-border bg-surface/40 p-4 transition hover:border-border-strong"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">{s.name}</span>
              <VisibilityChip visibility={s.visibility} />
              <span className="ml-auto text-[11px] text-faint">{fmtAgo(s.updated_at)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.test_ids.slice(0, 6).map((id) => (
                <span
                  key={id}
                  className="rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
                >
                  {nameById.get(id) ?? id.split("/").pop()}
                </span>
              ))}
              {s.test_ids.length > 6 && (
                <span className="px-1 text-[10.5px] text-faint">
                  +{s.test_ids.length - 6} more
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-faint">
                {s.test_ids.length} tests · {s.owner}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {s.owner === "you" && (
                  <button
                    onClick={() => void remove(s.id)}
                    title="Delete suite"
                    className="rounded-[7px] border border-border p-1.5 text-faint transition hover:border-danger/50 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <Button variant="secondary" size="sm" onClick={() => runSuite(s)}>
                  <Play className="h-3.5 w-3.5" />
                  Run suite
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SlideOver
        open={importing}
        onOpenChange={setImporting}
        title="Import a Jira test plan"
        description="One-way. The plan stays owned by Jira; this resolves it to runnable tests."
        widthClass="w-[560px]"
        footer={
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-faint">
              Results post back to the plan as each run finishes.
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={!plan || planMatched === 0}
              onClick={() => void importPlan()}
            >
              Import the {planMatched} matched test{planMatched === 1 ? "" : "s"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 p-5">
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">Plan key</div>
            <input
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              className="w-full rounded-[9px] border border-border bg-surface-raised px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.05em] text-faint">
              {plan ? `Resolved · ${planMatched} of ${plan.issues.length} issues` : "Resolving…"}
            </div>
            <div className="overflow-hidden rounded-[10px] border border-border">
              {(plan?.issues ?? []).map((r, i) => (
                <div
                  key={r.key}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2.5",
                    i > 0 && "border-t border-border/60",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-[92px] shrink-0 font-mono text-[10.5px] text-faint">
                      {r.key}
                    </span>
                    <div className="min-w-0">
                      {r.test ? (
                        <div className="truncate font-mono text-[12px] text-foreground">{r.test}</div>
                      ) : (
                        <div className="text-[12px] text-warning">no test covers this yet</div>
                      )}
                      {r.summary && (
                        <div className="truncate text-[10.5px] text-faint">{r.summary}</div>
                      )}
                    </div>
                  </div>
                  {r.test ? (
                    <span className="shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[10.5px] text-ok">
                      matched
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setImporting(false);
                        navigate("/library/generate");
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Generate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="border-l-2 border-accent pl-2.5 text-[11.5px] text-muted">
            Two issues have no test. Generate them now, or import the five that resolved and come
            back.
          </p>
        </div>
      </SlideOver>
    </div>
  );
}

function VisibilityChip({ visibility }: { visibility: TestSuite["visibility"] }) {
  const published = visibility === "published";
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
        published
          ? "border-ok/30 bg-ok/10 text-ok"
          : "border-border bg-surface-raised text-faint",
      )}
    >
      {published ? <Users className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
      {published ? "team" : "private"}
    </span>
  );
}
