import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { useWorkbench } from "@/lib/workbench";
import { environmentsClient } from "@/lib/environments";
import {
  checkEnvironment,
  describeRequirement,
  resolveRequirement,
} from "@/lib/requirement";
import type { EnvConfig } from "@/lib/contracts";

/**
 * The selection tray — a persistent dock that appears whenever ≥1 test is
 * selected and survives navigation. It shows the live-resolved requirement of
 * the set and how many environments satisfy it, and is the one way into the
 * "Set up run" composer.
 */
export function SelectionTray() {
  const { selected, clear, openComposer } = useWorkbench();
  const [envs, setEnvs] = useState<EnvConfig[]>([]);

  useEffect(() => {
    void environmentsClient.list().then(setEnvs);
  }, []);

  const up = selected.length > 0;
  const req = resolveRequirement(selected);
  const chips = describeRequirement(req);
  const matching = envs.filter((e) => checkEnvironment(e, req).ok).length;

  return (
    <div
      aria-hidden={!up}
      className={cn(
        "tray-dock pointer-events-none absolute inset-x-0 bottom-0 z-40 px-6 pb-4 pt-8",
        up && "is-up",
      )}
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, rgb(var(--canvas)) 40%)",
      }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center gap-4 rounded-[12px] border border-border-strong bg-surface px-3.5 py-2.5 shadow-2xl">
        <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
          {selected.length} selected
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.06em] text-faint">Needs</span>
            {chips.map((c) => (
              <span
                key={c}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10.5px]",
                  req?.conflict && c.includes("conflict")
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-border bg-surface-raised text-muted",
                )}
              >
                {c}
              </span>
            ))}
            <span className={cn("text-[11px]", matching ? "text-faint" : "text-warning")}>
              · {matching} matching env{matching === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-faint">
            {selected.map((t) => t.name).join(" · ")}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
        <Button variant="primary" size="sm" onClick={openComposer}>
          <Play className="h-3.5 w-3.5" /> Set up run
        </Button>
      </div>
    </div>
  );
}
