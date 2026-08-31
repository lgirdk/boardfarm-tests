import { useEffect, useState } from "react";
import type { Run } from "@/lib/contracts";
import { runsClient } from "./index";

/**
 * Live view of one run: subscribes on mount, updates on every RunEvent,
 * unsubscribes on unmount. The transport (mock timers vs future SSE/polling)
 * is hidden behind runsClient.subscribe.
 */
export function useRunSubscription(runId: string | undefined): {
  run: Run | null;
  notFound: boolean;
} {
  const [run, setRun] = useState<Run | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setRun(null);
    setNotFound(false);

    let active = true;
    void runsClient.get(runId).then((r) => {
      if (!active) return;
      if (!r) setNotFound(true);
      else setRun(r);
    });
    const unsubscribe = runsClient.subscribe(runId, (event) => {
      if (active) setRun(event.run);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [runId]);

  return { run, notFound };
}
