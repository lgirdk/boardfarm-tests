import { parse, stringify } from "smol-toml";
import type { ConfigDoc } from "./persistence/PersistenceAdapter";

/**
 * Thin wrapper over smol-toml. Centralised so the rest of the app speaks plain
 * objects and never imports the TOML library directly.
 */
export function parseToml(text: string): ConfigDoc {
  return parse(text) as ConfigDoc;
}

export function serializeToml(doc: ConfigDoc): string {
  // smol-toml rejects undefined values; strip them so optional unset keys simply
  // disappear. Empty strings are preserved — they can be meaningful (e.g.
  // passage_prefix = "").
  return stringify(stripUndefined(doc) as Record<string, unknown>);
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}
