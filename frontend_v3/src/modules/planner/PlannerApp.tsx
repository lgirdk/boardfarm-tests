import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { testsClient } from "@/lib/tests";
import { useWorkbench } from "@/lib/workbench";
import { cn } from "@/lib/cn";
import type { TestAsset } from "@/lib/contracts";

const SCOPES = ["voice", "tr069", "wifi", "docsis", "networking", "snmp", "gui"];

/**
 * Plan — planning is both “assemble what exists” and “invent what's missing”.
 * Given an intent, return two lists: tests already in the library (selectable
 * straight into the tray) and the gaps that need generating.
 */
export function PlannerApp() {
  const navigate = useNavigate();
  const { has, toggle, add } = useWorkbench();
  const [tests, setTests] = useState<TestAsset[]>([]);
  const [intent, setIntent] = useState(
    "Regression pass on voice: calls between FXS lines, codec negotiation, and hold/resume — on Sunrise F3896LG before the r22 release.",
  );
  const [scope, setScope] = useState<Set<string>>(new Set(["voice"]));
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<"intent" | "epic">("intent");
  const [epic, setEpic] = useState("MVX-R22-EXIT");

  useEffect(() => {
    void testsClient.list().then(setTests);
  }, []);

  const matches = useMemo(() => {
    if (!done) return [];
    const src = mode === "epic" ? epic : intent;
    const words = src.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return tests
      .filter(
        (t) =>
          scope.has(t.suite) ||
          t.tags.some((g) => scope.has(g)) ||
          words.some(
            (w) => t.name.includes(w) || (t.description ?? "").toLowerCase().includes(w),
          ),
      )
      .slice(0, 8);
  }, [done, tests, scope, intent, mode, epic]);

  const gaps = done ? gapsFor(scope) : [];

  function toggleScope(s: string) {
    setScope((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Plan a set of tests</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Describe what to cover. You get back what already exists (selectable) and the gaps
          that need generating — then run the lot as one job.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[380px_1fr]">
        {/* intent */}
        <div className="rounded-[12px] border border-border bg-surface/40 p-4">
          <div className="mb-3 flex gap-1 rounded-[9px] border border-border bg-surface-raised p-0.5">
            <button
              onClick={() => setMode("intent")}
              className={cn(
                "flex-1 rounded-[7px] py-1.5 text-[12px] transition",
                mode === "intent"
                  ? "bg-surface text-foreground shadow"
                  : "text-muted hover:text-foreground",
              )}
            >
              Describe intent
            </button>
            <button
              onClick={() => setMode("epic")}
              className={cn(
                "flex-1 rounded-[7px] py-1.5 text-[12px] transition",
                mode === "epic"
                  ? "bg-surface text-foreground shadow"
                  : "text-muted hover:text-foreground",
              )}
            >
              From a Jira epic
            </button>
          </div>

          {mode === "intent" ? (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                What do you need to cover?
              </div>
              <textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                rows={7}
                className="mt-2 w-full rounded-[9px] border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-accent/60"
              />
            </>
          ) : (
            <>
              <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                Jira epic key
              </div>
              <input
                value={epic}
                onChange={(e) => setEpic(e.target.value)}
                placeholder="MVX-R22-EXIT"
                className="mt-2 w-full rounded-[9px] border border-border bg-surface-raised px-3 py-2 font-mono text-[12.5px] text-foreground outline-none focus:border-accent/60"
              />
              <p className="mt-2 text-[11px] text-faint">
                We resolve the epic&apos;s stories to tests here, run them, and post results
                back. Nothing in Jira is edited from this side.
              </p>
            </>
          )}

          <div className="mt-3 text-[10.5px] uppercase tracking-[0.05em] text-faint">Scope</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s}
                onClick={() => toggleScope(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] transition",
                  scope.has(s)
                    ? "border-accent/60 bg-accent/15 text-foreground"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            className="mt-4 w-full justify-center"
            onClick={() => setDone(true)}
          >
            <ListChecks className="h-4 w-4" /> Find matching tests
          </Button>
        </div>

        {/* results */}
        <div>
          {!done ? (
            <div className="grid h-[360px] place-content-center rounded-[12px] border border-border bg-surface/40 text-center">
              <p className="text-[13px] text-muted">
                Two lists come back: what exists, and what&apos;s missing.
              </p>
              <p className="mt-1 text-[11px] text-faint">
                You never guess whether a test already covers something.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <section>
                <div className="flex items-baseline justify-between">
                  <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                    Already in the library · {matches.length}
                  </div>
                  {matches.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => add(matches)}>
                      Add all to selection
                    </Button>
                  )}
                </div>
                <div className="mt-2 overflow-hidden rounded-[11px] border border-border">
                  {matches.map((t, i) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5",
                        i > 0 && "border-t border-border/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={has(t.id)}
                        onChange={() => toggle(t)}
                        className="h-3.5 w-3.5 accent-[rgb(var(--accent))]"
                      />
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] text-foreground">{t.name}</div>
                        <div className="truncate text-[10.5px] text-faint">{t.description}</div>
                      </div>
                      <span className="ml-auto shrink-0 text-[10.5px] text-muted">
                        {t.env_modes.join("/")} · {t.runtime}
                      </span>
                    </div>
                  ))}
                  {matches.length === 0 && (
                    <div className="px-3 py-4 text-[11.5px] text-faint">
                      Nothing in the library matches — it&apos;s all gaps.
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                  Not covered yet · {gaps.length}
                </div>
                <div className="mt-2 space-y-2">
                  {gaps.map((g) => (
                    <div
                      key={g.name}
                      className="flex items-center justify-between rounded-[11px] border border-border bg-surface/40 p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] text-foreground">{g.name}</div>
                        <div className="text-[11px] text-faint">{g.desc}</div>
                        <div className="mt-1 text-[10.5px] text-warning">gap · {g.why}</div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate("/library/generate")}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Generate
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-l-2 border-accent pl-2.5 text-[11.5px] text-muted">
                  Selected tests join the tray. Generated ones land in Drafts and can join the
                  same run before they&apos;re published.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Gap {
  name: string;
  desc: string;
  why: string;
}
function gapsFor(scope: Set<string>): Gap[] {
  if (scope.has("voice"))
    return [
      {
        name: "test_voice_three_way_conference",
        desc: "Conference three FXS lines and verify all legs carry RTP.",
        why: "no existing test touches conference",
      },
      {
        name: "test_voice_codec_fallback_g729",
        desc: "Force G.711A to fail and verify fallback to G.729.",
        why: "codec negotiation is only tested for G.711A",
      },
    ];
  return [
    {
      name: "test_new_coverage_gap",
      desc: "A behaviour the current suite doesn't exercise.",
      why: "no existing test matches this intent",
    },
  ];
}
