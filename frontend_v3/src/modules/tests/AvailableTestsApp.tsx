import { useEffect, useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import { testsClient } from "@/lib/tests";
import { fmtAgo } from "@/lib/time";
import type { TestAsset } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * Available Tests — the git-backed catalog of real, runnable tests, grouped by
 * suite/area (the repo's structure). This is where you browse what CAN be run
 * or scheduled. Source of truth is git; the backend reads it and serves it.
 * (Distinct from Drafts, which are AI outputs pending publish.)
 */
export function AvailableTestsApp() {
  const [tests, setTests] = useState<TestAsset[] | null>(null);
  const [suite, setSuite] = useState<string | null>(null);

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
  const visible = tests?.filter((t) => !suite || t.suite === suite) ?? null;

  // Group the visible tests by suite for display.
  const grouped = useMemo(() => {
    const map = new Map<string, TestAsset[]>();
    for (const t of visible ?? []) {
      const list = map.get(t.suite) ?? [];
      list.push(t);
      map.set(t.suite, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Available tests</h1>
        <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-faint">
          <GitBranch className="h-3 w-3" />
          from git
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Runnable tests in the repo, by suite. Pick tests to run or schedule; their
        env_req marker decides which bed they need.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <SuiteChip label="all" active={suite === null} onClick={() => setSuite(null)} />
        {suites.map((s) => (
          <SuiteChip
            key={s}
            label={s}
            active={suite === s}
            onClick={() => setSuite(suite === s ? null : s)}
          />
        ))}
      </div>

      {tests === null && <p className="mt-6 text-sm text-faint">Loading catalog…</p>}

      <div className="mt-4 flex flex-col gap-5">
        {grouped.map(([suiteName, suiteTests]) => (
          <section key={suiteName}>
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-faint">
              {suiteName} · {suiteTests.length}
            </div>
            <div className="overflow-hidden rounded-[10px] border border-border">
              {suiteTests.map((test) => (
                <div
                  key={test.id}
                  className="flex items-center gap-3 border-b border-border/60 bg-surface/40 px-3.5 py-2.5 last:border-0"
                >
                  <span className="font-mono text-xs text-foreground">{test.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {test.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border px-2 py-px text-[10.5px] text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="ml-auto flex items-center gap-3 text-[11px] text-faint">
                    {test.env_req && (
                      <span title="env_req marker">
                        env: <span className="font-mono text-muted">{test.env_req}</span>
                      </span>
                    )}
                    <span>{fmtAgo(test.updated_at)}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SuiteChip({
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
