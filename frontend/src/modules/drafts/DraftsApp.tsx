import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code2, Play, RefreshCw, UploadCloud } from "lucide-react";
import { artifactsClient } from "@/lib/artifacts";
import { useWorkbench } from "@/lib/workbench";
import { SlideOver } from "@/components/SlideOver";
import { CodeView } from "@/components/CodeView";
import { Button } from "@/components/Button";
import { fmtAgo } from "@/lib/time";
import { CAPABILITY_LABEL } from "@/lib/requirement";
import { cn } from "@/lib/cn";
import type { Artifact, TestAsset } from "@/lib/contracts";

/**
 * Drafts — generated tests that aren't in the library yet. A draft is a real,
 * runnable thing: it can run on a bed like anything else. The one rule is that
 * publishing (committing to the git-backed library) only unlocks once the draft
 * has actually PASSED on a bed — no unproven code enters the catalog.
 */
type Filter = "all" | "draft" | "published";

export function DraftsApp() {
  const navigate = useNavigate();
  const { runTests } = useWorkbench();
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [viewing, setViewing] = useState<Artifact | null>(null);

  function reload() {
    void artifactsClient
      .list()
      .then((a) => setArtifacts(a.filter((x) => x.type === "test_code")));
  }
  useEffect(reload, []);

  const visible = useMemo(
    () => artifacts?.filter((a) => filter === "all" || a.status === filter) ?? null,
    [artifacts, filter],
  );

  async function publish(a: Artifact) {
    await artifactsClient.publish(a.id);
    reload();
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Drafts</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Generated tests that aren&apos;t in the library yet. A draft can run on a bed like
          anything else — but it only publishes once it has passed on one.
        </p>
      </div>

      <div className="px-6 py-6">
        <div className="flex gap-1.5">
          {(["all", "draft", "published"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] capitalize transition",
                filter === f
                  ? "border-accent/60 bg-accent/15 text-foreground"
                  : "border-border text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {visible === null && <p className="text-sm text-faint">Loading…</p>}
          {visible?.length === 0 && (
            <div className="rounded-[12px] border border-dashed border-border py-10 text-center text-[12.5px] text-faint">
              Nothing here yet — generate a test or plan a set.
            </div>
          )}
          {visible?.map((a) => {
            const published = a.status === "published";
            const canPublish = a.last_result === "passed";
            return (
              <div key={a.id} className="rounded-[12px] border border-border bg-surface/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] text-foreground">{a.name}</span>
                      {published && (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] text-ok">
                          published
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">
                      from {a.source_ref ?? "—"} · created {fmtAgo(a.created_at)}
                    </div>
                  </div>
                  <ResultBadge result={a.last_result ?? null} runs={a.run_count ?? 0} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.05em] text-faint">needs</span>
                  <Chip>{(a.env_modes ?? []).join("/") || "any"}</Chip>
                  <Chip>{a.lan_clients ?? 1} LAN</Chip>
                  {(a.capabilities ?? []).map((c) => (
                    <Chip key={c}>{CAPABILITY_LABEL[c] ?? c}</Chip>
                  ))}
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => setViewing(a)}>
                    <Code2 className="h-3.5 w-3.5" /> View code
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/library?tab=generate")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => runTests([draftAsset(a)])}>
                    <Play className="h-3.5 w-3.5" /> Run on a bed
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    {!published && !canPublish && (
                      <span className="text-[10.5px] text-faint">
                        publish unlocks once it passes on a bed
                      </span>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={published || !canPublish}
                      onClick={() => void publish(a)}
                    >
                      <UploadCloud className="h-3.5 w-3.5" /> {published ? "Published" : "Publish"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SlideOver
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewing(null)}
        title={viewing?.name ?? ""}
        description={viewing ? `from ${viewing.source_ref ?? "—"}` : undefined}
        widthClass="w-[min(760px,92vw)]"
      >
        {viewing && (
          <div className="p-5">
            <CodeView language="python" code={viewing.content} />
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] text-muted">
      {children}
    </span>
  );
}

function ResultBadge({
  result,
  runs,
}: {
  result: "passed" | "failed" | null;
  runs: number;
}) {
  if (runs === 0 || result === null)
    return <span className="text-[11px] text-faint">never run</span>;
  return (
    <div className="shrink-0 text-right">
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px]",
          result === "passed" ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger",
        )}
      >
        last {result}
      </span>
      <div className="mt-0.5 text-[10.5px] text-faint">
        {runs} run{runs === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** A draft is runnable — synthesize a TestAsset so it can flow into the composer. */
function draftAsset(a: Artifact): TestAsset {
  return {
    id: a.id,
    name: a.name.replace(/\.py$/, ""),
    path: `boardfarm/drafts/${a.name}`,
    suite: "drafts",
    tags: a.capabilities ?? [],
    env_modes: a.env_modes ?? ["dual"],
    lan_clients: a.lan_clients ?? 1,
    capabilities: a.capabilities ?? [],
    runtime: "~2m",
    description: `Draft generated from ${a.source_ref ?? "codegen"}`,
    source: "git",
    updated_at: a.created_at,
  };
}
