import type { RefTarget } from "./types";

/**
 * Resolves the set of valid keys for a cross-file reference target. Backed by
 * loaded config today (the MockAdapter), by the FastAPI dry-run resolve later.
 *
 * The three cross-file references in the system:
 *   #1 search.toml `encoder`         → store_config.toml [encoders.*]   (store.encoders)
 *   #2 codegen.toml [stages.*].llm   → app.toml [llm.*]                 (app.llm)
 *   #3 codegen.toml [stages.*].profile → codegen.toml [profiles.*]      (codegen.profiles)
 */
export interface RefResolver {
  keysFor(target: RefTarget): string[];
}

export interface RefError {
  /** Human path to the offending field, e.g. "stages.reasoning.llm". */
  location: string;
  value: string;
  target: RefTarget;
  message: string;
}

/** Validate one reference value. Returns null when valid (or empty). */
export function validateRef(
  value: string,
  target: RefTarget,
  location: string,
  resolver: RefResolver,
): RefError | null {
  if (!value) return null;
  const keys = resolver.keysFor(target);
  if (keys.includes(value)) return null;
  return {
    location,
    value,
    target,
    message: `"${value}" does not exist in ${describeTarget(target)} (available: ${
      keys.length ? keys.join(", ") : "none"
    })`,
  };
}

function describeTarget(target: RefTarget): string {
  switch (target) {
    case "app.llm":
      return "app.toml [llm.*]";
    case "store.encoders":
      return "store_config.toml [encoders.*]";
    case "codegen.profiles":
      return "codegen.toml [profiles.*]";
  }
}
