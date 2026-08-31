import type { ConfigDoc, ConfigFileId } from "./PersistenceAdapter";

/**
 * Seed data mirrors the REAL repository TOML files (configs/*.toml) verbatim, so
 * the UI shows true current values with no backend. When the HttpAdapter lands,
 * this seed is dropped and the same documents come from disk via FastAPI.
 *
 * Keep in sync with:
 *   configs/app.toml
 *   configs/search_store/store_config.toml
 *   configs/codegen/codegen.toml
 *   configs/codegen/search.toml
 */
export const SEED: Record<ConfigFileId, ConfigDoc> = {
  app: {
    llm: {
      sonnet: {
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        api_key_env: "ANTHROPIC_API_KEY",
      },
      custome_gpt4o: {
        provider: "openai",
        endpoint: "http://100.78.76.21:4000",
        model: "gpt-4o",
        api_key_env: "CUSTOME_GPT_API_KEY",
      },
      gemma4_26B_8bit: {
        provider: "openai",
        endpoint: "https://cvntpj0b9cuebc-8000.proxy.runpod.net/v1/",
        model: "gemma4:26b-a4b-it-q8_0",
      },
    },
    search_store: {
      store_config_path: "./configs/search_store/store_config.toml",
    },
    codegen: {
      pipeline_config_path: "./configs/codegen/codegen.toml",
      search_settings_path: "./configs/codegen/search.toml",
      domain_setup_entrypoint: "domain.boardfarm.domain_setup:codegen_setup",
    },
  },

  // The three surfaces below are seeded for later chunks; only `app` (LLM
  // Providers) is rendered today.
  store: {
    store: {
      artifacts_path: "./artifacts",
      stub_registry: { stub_index_path: "./artifacts/stubs_index.json" },
    },
    encoders: {
      bge_small: {
        encoder_type: "sentence_transformer",
        model_path: "./.models/bge-small-en-v1.5",
        local_files_only: true,
        batch_size: 32,
        query_prefix:
          "Represent this sentence for searching relevant passages: ",
        passage_prefix: "",
      },
      openai_small: {
        encoder_type: "openai",
        model: "text-embedding-3-small",
        api_key_env: "OPENAI_API_KEY",
      },
    },
    filters: {
      repo_priority_order: ["boardfarm-docsis", "boardfarm"],
      exclude_repos: ["boardfarm-lgi-utils", "boardfarm-lgi-shared"],
    },
  },

  search: {
    encoder: "bge_small",
    strategy: {
      use_rrf_scoring: true,
      include_raw_search_text: false,
      final_review_enabled: false,
      keep_rounds: 2,
      remove_rounds: 1,
    },
    defaults: { bm25_top_k: 5, faiss_top_k: 5, faiss_threshold: 45 },
    full_corpus: {
      search_enabled: true,
      bm25_top_k: 1,
      faiss_top_k: 1,
      faiss_threshold: 45,
    },
    sub_corpus_group: {
      opesource_usecase: {
        categories: ["use_cases"],
        repos: ["boardfarm-docsis", "boardfarm"],
        module_patterns: [],
        search_enabled: true,
        bm25_top_k: 4,
        faiss_top_k: 4,
        faiss_threshold: 45,
      },
    },
  },

  codegen: {
    stages: {
      reasoning: { llm: "sonnet", profile: "default" },
      search: { llm: "sonnet", profile: "default" },
      generation: { llm: "sonnet", profile: "default" },
    },
    profiles: {
      default: {
        description: "Works with Claude/Sonnet",
        compatible_models: ["claude-sonnet-4-5", "claude-opus"],
        prompt_variant: "standard",
        reasoning: { temperature: 0.5, max_tokens: 1536 },
        search: { temperature: 0.4, max_tokens: 2048 },
        generation: { temperature: 0.4, max_tokens: 4096 },
      },
    },
  },
};
