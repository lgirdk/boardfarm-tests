import { validateRef, type RefResolver } from "@/lib/schema/crossRefs";
import type { ConfigRecord } from "@/lib/schema/types";

/** Field-keyed errors (`llm` / `profile`); shaped to feed RecordForm directly. */
export type StageRefErrors = Record<string, string>;

/** True when a profile defines a usable `[profile.<stage>]` settings sub-table. */
export function hasStageSettings(
  profile: ConfigRecord | undefined,
  stageName: string,
): boolean {
  const sub = profile?.[stageName];
  if (!sub || typeof sub !== "object") return false;
  const s = sub as Record<string, unknown>;
  return s.temperature !== undefined && s.max_tokens !== undefined;
}

/**
 * Validates one `[stages.<stage>]` entry against the cross-file rules:
 *   #2 llm must exist in app.toml [llm.*]
 *   #3 profile must exist in [profiles.*]
 *   + the referenced profile must define a sub-table for THIS stage
 *     (a missing sub-table is an error, never a silent default).
 */
export function validateStage(
  stageName: string,
  stage: ConfigRecord,
  resolver: RefResolver,
  profiles: Record<string, ConfigRecord>,
): StageRefErrors {
  const errors: StageRefErrors = {};

  const llm = String(stage.llm ?? "");
  const llmErr = validateRef(llm, "app.llm", `stages.${stageName}.llm`, resolver);
  if (!llm) errors.llm = "Required";
  else if (llmErr) errors.llm = llmErr.message;

  const profile = String(stage.profile ?? "");
  const profErr = validateRef(
    profile,
    "codegen.profiles",
    `stages.${stageName}.profile`,
    resolver,
  );
  if (!profile) {
    errors.profile = "Required";
  } else if (profErr) {
    errors.profile = profErr.message;
  } else if (!hasStageSettings(profiles[profile], stageName)) {
    errors.profile = `Profile "${profile}" defines no [profiles.${profile}.${stageName}] settings sub-table`;
  }

  return errors;
}
