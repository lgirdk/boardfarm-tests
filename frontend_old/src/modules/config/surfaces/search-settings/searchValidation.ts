import type { ConfigRecord } from "@/lib/schema/types";

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The sub-corpus group rule the backend enforces (_SubCorpusGroupConfig
 * .at_least_one_selector): at least one of categories / repos / module_patterns
 * must be non-empty. Returned keyed by `categories` so it surfaces on the first
 * selector axis. This is the cross-field check the per-field schema can't express.
 */
export function validateSubCorpusAxes(
  record: ConfigRecord,
): Record<string, string> {
  const empty =
    asArray(record.categories).length === 0 &&
    asArray(record.repos).length === 0 &&
    asArray(record.module_patterns).length === 0;
  return empty
    ? {
        categories:
          "At least one of categories, repos, or module_patterns must be non-empty",
      }
    : {};
}
