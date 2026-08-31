/**
 * Deterministic pseudo run-history for a test, so the catalog and dashboard can
 * show a health trend before the backend serves real history. Same id → same
 * history every render. Replace with GET /api/tests/{id}/history when the bridge
 * lands.
 */
export interface TestHealth {
  /** Last N outcomes, newest last (true = pass). */
  history: boolean[];
  passes: number;
  total: number;
  /** Mixed pass/fail in the window = flaky. */
  flaky: boolean;
  /** All-pass window. */
  healthy: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function testHealth(id: string, n = 5): TestHealth {
  const seed = hash(id);
  const history: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const bit = (seed >> (i * 3)) & 0b111;
    history.push(bit > 1);
  }
  const passes = history.filter(Boolean).length;
  return {
    history,
    passes,
    total: n,
    flaky: passes > 0 && passes < n,
    healthy: passes === n,
  };
}
