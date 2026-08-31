import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { artifactsClient } from "@/lib/artifacts";
import { useAuth } from "@/lib/auth";
import { fmtAgo } from "@/lib/time";
import type { Artifact, ArtifactStatus } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * Drafts — what the AI apps and workflows PRODUCE (generated code, plans,
 * analyses, env files). These are transient until published: publishing a draft
 * commits it to git, at which point it becomes an entry in Available Tests.
 * (Distinct from Available Tests, which is the git-backed catalog of real tests.)
 */
type Filter = "all" | ArtifactStatus;

export function DraftsApp() {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;
    void artifactsClient
      .list(user?.workspace.id ?? "docsis-team")
      .then((a) => active && setArtifacts(a));
    return () => {
      active = false;
    };
  }, [user]);

  const visible =
    artifacts?.filter((a) => filter === "all" || a.status === filter) ?? null;

  return (
    <div className="px-6 py-6">
      <h1 className="text-lg font-semibold">Drafts</h1>
      <p className="mt-0.5 text-xs text-muted">
        Outputs the apps and workflows produced. Publish a draft to commit it to
        git — it then appears in Available Tests.
      </p>

      <div className="mt-4 flex gap-1.5">
        {(["all", "draft", "published"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11.5px] transition",
              filter === f
                ? "border-accent/60 bg-accent/15 text-foreground"
                : "border-border text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-[10px] border border-border">
        <table className="w-full text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] tracking-[0.06em] text-faint">
              <th className="px-3.5 py-2 font-normal">name</th>
              <th className="px-3.5 py-2 font-normal">type</th>
              <th className="px-3.5 py-2 font-normal">status</th>
              <th className="px-3.5 py-2 font-normal">from run</th>
              <th className="px-3.5 py-2 font-normal">created</th>
            </tr>
          </thead>
          <tbody>
            {visible === null && (
              <tr>
                <td colSpan={5} className="px-3.5 py-6 text-center text-faint">
                  Loading…
                </td>
              </tr>
            )}
            {visible?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3.5 py-8 text-center text-faint">
                  Nothing here yet — generate a test or run a pipeline.
                </td>
              </tr>
            )}
            {visible?.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border/60 bg-surface/40 last:border-0"
              >
                <td className="px-3.5 py-2.5 font-mono text-xs text-foreground">
                  {a.name}
                </td>
                <td className="px-3.5 py-2.5 text-muted">{a.type}</td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px]",
                      a.status === "published"
                        ? "bg-ok/15 text-ok"
                        : "bg-idle/20 text-muted",
                    )}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[11px] text-faint">
                  {a.run_id ? (
                    <Link to={`/runs/${a.run_id}`} className="text-accent hover:underline">
                      #{a.run_id}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-faint">{fmtAgo(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
