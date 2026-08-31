import type {
  ConfigRecord,
  EnumOption,
  ObjectSchema,
  RefField,
} from "@/lib/schema/types";
import type { Registries } from "@/lib/registries";

/**
 * Descriptor data for codegen/search.toml (CodegenSearchSettings).
 * Help text is lifted from the comments in configs/codegen/search.toml.
 *
 * Cross-file reference #1: top-level `encoder` → store_config.toml [encoders.*].
 *
 * The category options for sub-corpus groups come from the live backend
 * registries (`stub_categories`) — if the backend can't enumerate them, the
 * UI falls back to the seed list in `lib/registries/seed.ts`.
 */

/** Top-level `encoder` reference into the Search Store's encoders. */
export const encoderRefField: RefField = {
  kind: "ref",
  key: "encoder",
  label: "Encoder",
  required: true,
  refTarget: "store.encoders",
  description:
    "References an encoder defined in search_store/store_config.toml [encoders.*]. (cross-file)",
};

/** [strategy] — global search behaviour applied across all corpora. */
export const strategySchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "bool",
      key: "use_rrf_scoring",
      label: "Use RRF scoring",
      description: "Combine BM25 + FAISS scores using Reciprocal Rank Fusion.",
    },
    {
      kind: "bool",
      key: "include_raw_search_text",
      label: "Include raw search text",
      description:
        "Include raw test step text alongside LLM-generated queries.",
    },
    {
      kind: "bool",
      key: "final_review_enabled",
      label: "Final review enabled",
      description: "Run one final LLM review on merged results from all corpora.",
    },
    {
      kind: "int",
      key: "keep_rounds",
      label: "Keep rounds",
      min: 0,
      description: "Global LLM review rounds (keep style).",
    },
    {
      kind: "int",
      key: "remove_rounds",
      label: "Remove rounds",
      min: 0,
      description: "Global LLM review rounds (remove style).",
    },
  ],
};

/** Shared k/threshold fields used by both [defaults] and [full_corpus]. */
const kThresholdFields: ObjectSchema["fields"] = [
  {
    kind: "int",
    key: "bm25_top_k",
    label: "BM25 top-k",
    min: 0,
    description: "Results per query from BM25 keyword search.",
  },
  {
    kind: "int",
    key: "faiss_top_k",
    label: "FAISS top-k",
    min: 0,
    description: "Results per query from FAISS semantic search.",
  },
  {
    kind: "int",
    key: "faiss_threshold",
    label: "FAISS threshold",
    min: 0,
    max: 100,
    description: "Minimum similarity score (0-100) for FAISS.",
  },
];

/** [defaults] — applied to any corpus that doesn't specify its own values. */
export const defaultsSchema: ObjectSchema = {
  kind: "object",
  fields: kThresholdFields,
};

/** [full_corpus] — fallback search across the entire codebase. */
export const fullCorpusSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "bool",
      key: "search_enabled",
      label: "Search enabled",
      description: "Fallback/catch-all corpus. Can be disabled.",
    },
    ...kThresholdFields,
  ],
};

/**
 * Build the sub-corpus group schema using live category options from the
 * backend registries. The `categories` field is a constrained enum list whose
 * allowed values are the stub-index categories the backend knows about.
 *
 * Rule (enforced separately, see searchValidation): at least one of
 * categories/repos/module_patterns must be non-empty; multiple non-empty axes
 * are AND-ed.
 */
export function makeSubCorpusGroupSchema(
  registries: Registries,
): ObjectSchema {
  const categoryOptions: EnumOption[] = registries.stub_categories.map(
    (value) => ({ value }),
  );
  const allowedList = registries.stub_categories.join(", ");
  return {
    kind: "object",
    fields: [
      {
        kind: "list",
        key: "categories",
        itemKind: "enum",
        options: categoryOptions,
        label: "Categories",
        description: `Match entry category (exact). Allowed: ${allowedList}.`,
      },
      {
        kind: "list",
        key: "repos",
        itemKind: "string",
        label: "Repos",
        description: "Match entry repo name (exact).",
      },
      {
        kind: "list",
        key: "module_patterns",
        itemKind: "string",
        label: "Module patterns",
        description: "Match entry file path (contains).",
      },
      {
        kind: "bool",
        key: "search_enabled",
        label: "Search enabled",
        description: "Enable/disable this group.",
      },
      ...kThresholdFields,
    ],
  };
}

/** Template for a new sub-corpus group (mirrors the commented template in the file). */
export function newSubCorpusGroupRecord(): ConfigRecord {
  return {
    categories: [],
    repos: [],
    module_patterns: [],
    search_enabled: true,
    bm25_top_k: 6,
    faiss_top_k: 6,
    faiss_threshold: 45,
  };
}
