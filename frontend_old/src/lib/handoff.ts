import type { CodegenPrefill } from "@/lib/contracts";

/**
 * Typed cross-app handoff (planner → codegen). Carried via sessionStorage so
 * it survives the navigation without route-state hacks, and consumed exactly
 * once so a page refresh doesn't resurrect a stale prefill.
 */

const KEY = "handoff:codegen-prefill";

export function setCodegenPrefill(prefill: CodegenPrefill): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(prefill));
  } catch {
    // storage unavailable — handoff silently degrades to an empty form
  }
}

export function consumeCodegenPrefill(): CodegenPrefill | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as CodegenPrefill;
  } catch {
    return null;
  }
}
