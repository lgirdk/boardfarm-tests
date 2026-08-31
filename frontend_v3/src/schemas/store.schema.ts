import type {
  ConfigRecord,
  ObjectSchema,
  PolymorphicSchema,
} from "@/lib/schema/types";

/**
 * Descriptor data for search_store/store_config.toml (StoreConfig).
 *
 *   [store] artifacts_path                  → store.artifacts_path
 *   [store.stub_registry] stub_index_path   → store.stub_registry.stub_index_path
 *   [encoders.<name>]                       → polymorphic by encoder_type
 *   [filters] repo_priority_order (ordered), exclude_repos
 */

/** [store] artifacts_path. */
export const storeRootSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "string",
      key: "artifacts_path",
      label: "Artifacts path",
      required: true,
      format: "path",
      description: "Base directory for all generated files (internal).",
    },
  ],
};

/** [store.stub_registry] stub_index_path. */
export const stubRegistrySchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "string",
      key: "stub_index_path",
      label: "Stub index path",
      required: true,
      format: "path",
      description: "Raw stub index built from the codebase.",
    },
  ],
};

/**
 * [encoders.<name>] — polymorphic by `encoder_type`. Field sets mirror
 * _SentenceTransformerConfig and _OpenAIEncoderConfig in
 * src/search_store/config_schema.py.
 */
export const encoderSchema: PolymorphicSchema = {
  kind: "polymorphic",
  discriminator: "encoder_type",
  common: [],
  variants: [
    {
      value: "sentence_transformer",
      label: "Sentence Transformer (local)",
      fields: [
        {
          kind: "string",
          key: "model_path",
          label: "Model path",
          required: true,
          format: "path",
          description: "Path to the local SentenceTransformer model.",
        },
        {
          kind: "bool",
          key: "local_files_only",
          label: "Local files only",
          description: "Never reach the network to fetch the model.",
        },
        {
          kind: "int",
          key: "batch_size",
          label: "Batch size",
          min: 1,
          description: "Encoding batch size.",
        },
        {
          kind: "string",
          key: "query_prefix",
          label: "Query prefix",
          description:
            "Prepended to queries at search time (e.g. an instruction prefix).",
        },
        {
          kind: "string",
          key: "passage_prefix",
          label: "Passage prefix",
          description: "Prepended to passages/documents at indexing time.",
        },
      ],
    },
    {
      value: "openai",
      label: "OpenAI",
      fields: [
        {
          kind: "string",
          key: "model",
          label: "Model",
          required: true,
          placeholder: "text-embedding-3-small",
          description: "OpenAI embedding model id.",
        },
        {
          kind: "string",
          key: "api_key_env",
          label: "API key env var",
          required: true,
          format: "env-var",
          description: "Environment variable holding the OpenAI API key.",
        },
      ],
    },
  ],
};

/** [filters] — repo priority (ordered) + exclusions. */
export const filtersSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "list",
      key: "repo_priority_order",
      itemKind: "string",
      ordered: true,
      label: "Repo priority order",
      description: "Order defines priority: first = highest.",
    },
    {
      kind: "list",
      key: "exclude_repos",
      itemKind: "string",
      label: "Exclude repos",
      description: "Entries from these repos are excluded entirely.",
    },
  ],
};

/** Template for a new encoder (defaults to a local sentence-transformer). */
export function newEncoderRecord(): ConfigRecord {
  return {
    encoder_type: "sentence_transformer",
    model_path: "",
    local_files_only: true,
    batch_size: 32,
    query_prefix: "",
    passage_prefix: "",
  };
}
