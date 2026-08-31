import type {
  ConfigRecord,
  EnumOption,
  ObjectSchema,
} from "@/lib/schema/types";
import type { Registries } from "@/lib/registries";

/**
 * Descriptor data for codegen.toml.
 *
 * Structure (src/codegen/config_schema.py):
 *   [stages.<stage>]            → { llm (→app.toml [llm.*]), profile (→[profiles.*]) }
 *   [profiles.<name>]           → description, compatible_models, prompt_variant
 *   [profiles.<name>.<stage>]   → { temperature, max_tokens } per stage
 *
 * Stage names are NOT hardcoded here — they're read from the live [stages.*]
 * keys (today: reasoning/search/generation, fixed by the backend's _CodegenStages).
 *
 * Cross-file references enforced before save:
 *   #2 stage.llm     → app.toml [llm.*]
 *   #3 stage.profile → codegen.toml [profiles.*]
 *   + a referenced profile must define a sub-table for the referencing stage.
 */

/** One `[stages.<stage>]` entry: two cross-file references. */
export const stageItemSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "ref",
      key: "llm",
      label: "LLM",
      required: true,
      refTarget: "app.llm",
      description:
        "Which registered LLM runs this stage. Must exist in app.toml [llm.*].",
    },
    {
      kind: "ref",
      key: "profile",
      label: "Profile",
      required: true,
      refTarget: "codegen.profiles",
      description:
        "Which profile supplies this stage's settings. Must exist below and define a sub-table for this stage.",
    },
  ],
};

/**
 * Build the profile metadata schema using the backend's known prompt variants.
 *
 * `prompt_variant` is a closed enum (CodegenPromptVariant). Its allowed values
 * come from the backend registries; we don't hardcode them here so adding a
 * new variant in Python reaches the UI automatically.
 */
export function makeProfileMetaSchema(registries: Registries): ObjectSchema {
  const promptVariantOptions: EnumOption[] = registries.prompt_variants.map(
    (value) => ({ value }),
  );
  return {
    kind: "object",
    fields: [
      {
        kind: "string",
        key: "description",
        label: "Description",
        placeholder: "Tuned for Claude/Sonnet",
        description: "Human note describing what this profile is for.",
      },
      {
        kind: "list",
        key: "compatible_models",
        itemKind: "string",
        label: "Compatible models",
        description:
          "Informational list of model ids this profile is intended for (e.g. claude-sonnet-4-5).",
      },
      {
        kind: "enum",
        key: "prompt_variant",
        label: "Prompt variant",
        required: true,
        description:
          "Which prompt template family to use for generation (CodegenPromptVariant).",
        options: promptVariantOptions,
      },
    ],
  };
}

/** Per-stage LLM call settings within a profile (`[profiles.<name>.<stage>]`). */
export const stageSettingsSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "float",
      key: "temperature",
      label: "Temperature",
      required: true,
      min: 0,
      max: 2,
      description: "Sampling temperature for this stage.",
    },
    {
      kind: "int",
      key: "max_tokens",
      label: "Max tokens",
      required: true,
      min: 1,
      description: "Maximum output tokens for this stage.",
    },
  ],
};

/**
 * Template for a freshly added profile — one settings sub-table per stage.
 * Defaults `prompt_variant` to the first known variant from the registries.
 */
export function newProfileRecord(
  stageNames: string[],
  registries: Registries,
): ConfigRecord {
  const defaultVariant = registries.prompt_variants[0] ?? "standard";
  const record: ConfigRecord = {
    description: "",
    compatible_models: [],
    prompt_variant: defaultVariant,
  };
  for (const stage of stageNames) {
    record[stage] = { temperature: 0.4, max_tokens: 2048 };
  }
  return record;
}
