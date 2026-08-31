/** Small time formatting helpers (mono data displays). */

export function fmtDuration(ms: number | undefined): string {
  if (ms === undefined || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  const rem = s % 60;
  if (min < 60) return rem ? `${min}m ${rem}s` : `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export function fmtAgo(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function runDuration(run: {
  started_at?: number;
  finished_at?: number;
}): string {
  if (!run.started_at) return "—";
  return fmtDuration((run.finished_at ?? Date.now()) - run.started_at);
}
