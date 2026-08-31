import { useMemo } from "react";
import { diffLines } from "diff";
import { cn } from "@/lib/cn";

export interface DiffViewProps {
  before: string;
  after: string;
  /** Shown when before === after. */
  emptyLabel?: string;
}

/**
 * Line-level before/after diff. The write path shows this before anything is
 * committed to disk — config controls a live pipeline, so saves are consequential.
 */
export function DiffView({
  before,
  after,
  emptyLabel = "No changes.",
}: DiffViewProps) {
  const parts = useMemo(() => diffLines(before, after), [before, after]);

  const hasChanges = parts.some((p) => p.added || p.removed);
  if (!hasChanges) {
    return <p className="px-4 py-6 text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-surface-inset p-3 font-mono text-xs leading-relaxed">
      {parts.map((part, i) => {
        const lines = part.value.replace(/\n$/, "").split("\n");
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={cn(
              "whitespace-pre",
              part.added && "bg-ok/15 text-ok",
              part.removed && "bg-danger/15 text-danger",
              !part.added && !part.removed && "text-muted",
            )}
          >
            <span className="select-none opacity-60">
              {part.added ? "+" : part.removed ? "-" : " "}{" "}
            </span>
            {line}
          </div>
        ));
      })}
    </pre>
  );
}
