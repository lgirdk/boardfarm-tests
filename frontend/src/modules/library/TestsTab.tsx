import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, GitBranch, Play, Search, Sparkles, X } from "lucide-react";
import { testsClient } from "@/lib/tests";
import { fmtAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { useWorkbench } from "@/lib/workbench";
import type { TestAsset } from "@/lib/contracts";

interface Hit {
  t: TestAsset;
  why: string | null;
  score: number;
}

/**
 * The test catalog. Clicking a row (or Run) opens the test-detail drawer; the
 * checkbox drops it into the persistent selection tray. Search covers name,
 * tags, description AND step text, and every result says why it matched.
 */
export function TestsTab() {
  const { has, toggle, openTest } = useWorkbench();
  const [tests, setTests] = useState<TestAsset[] | null>(null);
  const [query, setQuery] = useState("");
  const [suite, setSuite] = useState<string | null>(null);
  const [flakyOnly, setFlakyOnly] = useState(false);

  useEffect(() => {
    let active = true;
    void testsClient.list().then((t) => active && setTests(t));
    return () => {
      active = false;
    };
  }, []);

  const suites = useMemo(
    () => [...new Set(tests?.map((t) => t.suite) ?? [])].sort(),
    [tests],
  );

  const results = useMemo<Hit[]>(() => {
    const base = search(tests ?? [], query);
    return base.filter(
      ({ t }) => (!suite || t.suite === suite) && (!flakyOnly || isFlaky(t)),
    );
  }, [tests, query, suite, flakyOnly]);

  return (
    <div className="px-6 py-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “lan to wan ping” — search covers step text, not just names"
            className="w-full rounded-[9px] border border-border bg-surface-raised py-2 pl-8 pr-8 text-[12.5px] text-foreground outline-none transition placeholder:text-faint focus:border-accent/60"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] text-faint">
          <GitBranch className="h-3 w-3" />
          from git
        </span>
        <Link to="/library?tab=generate">
          <Button variant="secondary" size="sm">
            <Sparkles className="h-3.5 w-3.5" />
            Generate a test
          </Button>
        </Link>
      </div>

      {/* facets */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip label="all" active={suite === null} onClick={() => setSuite(null)} />
        {suites.map((s) => (
          <Chip
            key={s}
            label={s}
            active={suite === s}
            onClick={() => setSuite(suite === s ? null : s)}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          onClick={() => setFlakyOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] transition",
            flakyOnly
              ? "border-warning/50 bg-warning/10 text-warning"
              : "border-border text-muted hover:border-border-strong hover:text-foreground",
          )}
        >
          <Activity className="h-3 w-3" />
          flaky only
        </button>
        {query && (
          <span className="ml-auto text-[11px] text-faint">
            {results.length} result{results.length === 1 ? "" : "s"} · ranked over name, tags,
            description, step text
          </span>
        )}
      </div>

      {/* table */}
      <div className="mt-4 overflow-hidden rounded-[11px] border border-border">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface/60 text-[11px] uppercase tracking-[0.05em] text-faint">
              <th className="w-8 py-2 pl-3.5" />
              <th className="py-2 pr-3 font-medium">Test</th>
              <th className="py-2 pr-3 font-medium">Suite</th>
              <th className="py-2 pr-3 font-medium">Requires</th>
              <th className="hidden py-2 pr-3 font-medium lg:table-cell">Runtime</th>
              <th className="hidden py-2 pr-3 font-medium lg:table-cell">Updated</th>
              <th className="py-2 pr-3.5 text-right font-medium">Run</th>
            </tr>
          </thead>
          <tbody>
            {tests === null && (
              <tr>
                <td colSpan={7} className="px-3.5 py-8 text-center text-sm text-faint">
                  Loading catalog…
                </td>
              </tr>
            )}
            {results.map(({ t, why }) => {
              const selected = has(t.id);
              const flaky = isFlaky(t);
              const { passes, total } = healthOf(t);
              return (
                <tr
                  key={t.id}
                  onClick={() => openTest(t)}
                  className={cn(
                    "cursor-pointer border-t border-border/60 transition hover:bg-surface/50",
                    selected && "bg-accent/[0.06]",
                  )}
                >
                  <td className="py-2.5 pl-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(t)}
                      aria-label={`Select ${t.name}`}
                      className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                    />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] text-foreground">{t.name}</span>
                      {flaky && (
                        <span
                          className="rounded-full border border-warning/40 bg-warning/10 px-1.5 text-[10px] text-warning"
                          title={`Failed ${total - passes} of its last ${total} runs`}
                        >
                          {passes}/{total}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[10.5px] text-faint">{t.description}</div>
                    {why && (
                      <div className="mt-0.5 text-[10.5px] text-highlight">matched on {why}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[11px] text-muted">
                      {t.suite}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-[11px] text-muted">
                    {t.env_modes.join("/")}
                    {t.lan_clients ? ` · ${t.lan_clients} lan` : ""}
                    {t.capabilities.length ? ` · ${t.capabilities.join(", ")}` : ""}
                  </td>
                  <td className="hidden py-2.5 pr-3 font-mono text-[11px] text-faint lg:table-cell">
                    {t.runtime}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-[11px] text-faint lg:table-cell">
                    {fmtAgo(t.updated_at)}
                  </td>
                  <td
                    className="py-2.5 pr-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openTest(t)}
                      title="Review and run"
                      className="inline-flex items-center gap-1 rounded-[7px] border border-border px-2 py-1 text-[11.5px] text-muted transition hover:border-accent/50 hover:bg-accent/10 hover:text-foreground"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </button>
                  </td>
                </tr>
              );
            })}
            {tests !== null && results.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3.5 py-10 text-center">
                  <p className="text-sm text-muted">Nothing matches “{query}”.</p>
                  <Link to="/library?tab=generate" className="mt-2 inline-block">
                    <Button variant="secondary" size="sm">
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate this test
                    </Button>
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function healthOf(t: TestAsset): { passes: number; total: number } {
  const h = t.health ?? [];
  return { passes: h.filter((x) => x === 1).length, total: h.length || 8 };
}
function isFlaky(t: TestAsset): boolean {
  const { passes, total } = healthOf(t);
  return passes / total < 0.8;
}

/** Client-side stand-in for the backend index: ranks over name/tags/desc/steps. */
function search(tests: TestAsset[], q: string): Hit[] {
  if (!q.trim()) return tests.map((t) => ({ t, why: null, score: 0 }));
  const w = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits: Hit[] = [];
  for (const t of tests) {
    const hitName = w.filter((x) => t.name.toLowerCase().includes(x)).length;
    const hitTag = w.filter((x) => t.tags.some((g) => g.includes(x))).length;
    const hitDesc = w.filter((x) => (t.description ?? "").toLowerCase().includes(x)).length;
    let stepIdx = -1;
    let stepHits = 0;
    (t.steps ?? []).forEach((s, i) => {
      const n = w.filter((x) => s.toLowerCase().includes(x)).length;
      if (n > stepHits) {
        stepHits = n;
        stepIdx = i;
      }
    });
    const score = hitName * 3 + hitTag * 2.5 + hitDesc * 2 + stepHits * 1.8;
    if (!score) continue;
    const why = hitName
      ? "name"
      : hitTag
        ? `tag ${t.tags.find((g) => w.some((x) => g.includes(x)))}`
        : hitDesc
          ? "description"
          : `step ${stepIdx + 1} · “${t.steps?.[stepIdx]}”`;
    hits.push({ t, why, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}

function Chip({
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
