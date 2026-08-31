import type { Schedule } from "@/lib/contracts";

/** Seeded schedules — the nightly + weekly cadences a lab actually runs. */
export const SCHEDULES_SEED: Schedule[] = [
  {
    id: "sch-nightly-sanity",
    name: "nightly-sanity",
    what: "12 tests · docsis + networking",
    cron: "0 2 * * *",
    human: "Every day at 02:00",
    board: "CH7465LG (any free bed)",
    env: "env-ch7465-upc-dual-voice",
    enabled: true,
    last: "8h ago",
    last_state: "completed",
    next: "in 6h 12m",
  },
  {
    id: "sch-voice-weekly",
    name: "voice-regression-weekly",
    what: "3 tests · voice",
    cron: "0 3 * * 6",
    human: "Saturdays at 03:00",
    board: "F3896LG (any free bed)",
    env: "env-ch7465-upc-dual-voice",
    enabled: true,
    last: "5d ago",
    last_state: "completed",
    next: "in 2d 4h",
  },
  {
    id: "sch-tr069-sweep",
    name: "tr069-full-sweep",
    what: "3 tests · tr069",
    cron: "0 1 * * 1-5",
    human: "Weekdays at 01:00",
    board: "F3896LG (any free bed)",
    env: "env-f3896-sunrise-wifi5-tr069",
    enabled: false,
    last: "12d ago",
    last_state: "failed",
    next: "paused",
  },
];
