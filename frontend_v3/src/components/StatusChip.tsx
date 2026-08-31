import type { RunStatus } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * Status chip. Semantic colors: green pass, red fail, blue running, amber awaiting.
 * Uses tinted background with colored text — works on both light and dark themes.
 */
const STYLE: Record<RunStatus, string> = {
  queued: "bg-idle/20 text-faint",
  running: "bg-running/[.14] text-running",
  awaiting_approval: "bg-warning/[.14] text-warning",
  completed: "bg-ok/[.13] text-ok",
  failed: "bg-danger/[.13] text-danger",
  cancelled: "bg-idle/20 text-faint",
};

const LABEL: Record<RunStatus, string> = {
  queued: "queued",
  running: "running",
  awaiting_approval: "awaiting",
  completed: "passed",
  failed: "failed",
  cancelled: "cancelled",
};

export function StatusChip({
  status,
  className,
}: {
  status: RunStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px] whitespace-nowrap rounded-full px-[11px] py-[3.5px] text-[11px] font-semibold",
        STYLE[status],
        className,
      )}
    >
      {status === "running" && (
        <span className="h-[7px] w-[7px] rounded-full bg-running animate-pulse-dot" />
      )}
      {LABEL[status]}
    </span>
  );
}
