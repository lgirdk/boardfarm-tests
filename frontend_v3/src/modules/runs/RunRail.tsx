import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RailNode, RailState } from "./runRail";

/**
 * The vertical run rail: one node per step. Dot semantics (reserved colors):
 * green check = done, blue pulsing = running, amber + halo = awaiting
 * approval, red = failed, hollow = pending/skipped.
 */

function Dot({ state }: { state: RailState }) {
  switch (state) {
    case "done":
      return (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ok">
          <Check className="h-2 w-2 text-canvas" strokeWidth={3.5} />
        </span>
      );
    case "running":
      return <span className="h-3.5 w-3.5 rounded-full bg-running animate-pulse-dot" />;
    case "awaiting":
      return <span className="h-3.5 w-3.5 rounded-full bg-warning halo-wait" />;
    case "failed":
      return <span className="h-3.5 w-3.5 rounded-full bg-danger" />;
    default:
      return <span className="h-3.5 w-3.5 rounded-full border-[1.5px] border-idle" />;
  }
}

const TITLE_COLOR: Record<RailState, string> = {
  done: "text-foreground",
  running: "text-running",
  awaiting: "text-warning",
  failed: "text-danger",
  pending: "text-faint",
  skipped: "text-faint line-through",
};

export interface RunRailProps {
  nodes: RailNode[];
  selected?: string;
  onSelect: (stepName: string) => void;
}

export function RunRail({ nodes, selected, onSelect }: RunRailProps) {
  return (
    <div>
      {nodes.map((node, i) => {
        const last = i === nodes.length - 1;
        return (
          <div key={node.name} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <Dot state={node.state} />
              {!last && <div className="w-px flex-1 bg-border-strong min-h-[22px]" />}
            </div>
            <button
              onClick={() => onSelect(node.name)}
              className={cn(
                "min-w-0 pb-3.5 text-left transition",
                selected === node.name && "opacity-100",
                selected !== node.name && "opacity-90 hover:opacity-100",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono text-xs",
                  TITLE_COLOR[node.state],
                  selected === node.name && "underline decoration-border-strong underline-offset-4",
                )}
              >
                {node.name}
                {node.label && (
                  <span className="rounded border border-border px-1 py-px text-[9.5px] text-faint">
                    {node.label}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "text-[11px]",
                  node.state === "awaiting" ? "text-warning/70" : "text-faint",
                )}
              >
                {node.detail}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
