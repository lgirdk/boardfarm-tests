import type { RunStatus } from "@/lib/contracts";
import { cn } from "@/lib/cn";

/**
 * Status chip. Semantic colors are reserved for status: green pass, red fail,
 * blue running, amber awaiting. Awaiting approval is the only FILLED chip
 * (dark amber text on amber) — it's the one that needs the user.
 */
const STYLE: Record<RunStatus, string> = {
  queued: "bg-idle/20 text-muted",
  running: "bg-running/15 text-running",
  awaiting_approval: "bg-warning text-[#3E2E08] font-medium",
  completed: "bg-ok/15 text-ok",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-idle/20 text-faint",
};

const LABEL: Record<RunStatus, string> = {
  queued: "queued",
  running: "running",
  awaiting_approval: "awaiting approval",
  completed: "completed",
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
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px]",
        STYLE[status],
        className,
      )}
    >
      {LABEL[status]}
    </span>
  );
}
