import type { Registries } from "./RegistriesClient";

/**
 * Canned registries data — mirrors what the real backend would return based on
 * the current `LLM_CLIENT_REGISTRY` registrations in src/orchestrator.py and
 * the enums in src/codegen/enums.py / src/search_store/. Keep in sync so the
 * mock matches the real backend's expected shape.
 *
 * When the HttpRegistriesClient lands, this seed becomes redundant for normal
 * runs but remains the fallback if the backend is unreachable.
 */
export const REGISTRIES_SEED: Registries = {
  llm_clients: [
    { name: "sonnet", client_class: "AnthropicClient", provider: "anthropic" },
    {
      name: "custome_gpt4o",
      client_class: "CustomeOpenAIGPT4oClient",
      provider: "openai",
    },
    { name: "openai_llm", client_class: "OpenAIClient", provider: "openai" },
    {
      name: "gemma4_26B_8bit",
      client_class: "CustomeOpenAIGPT4oClient",
      provider: "openai",
    },
  ],
  encoder_types: ["sentence_transformer", "openai"],
  search_filters: ["repo_priority_order", "exclude_repos"],
  codegen_stages: ["reasoning", "search", "generation"],
  prompt_variants: ["standard", "compact"],
  output_types: ["pytest", "robot"],
  include_strategies: ["by_names", "by_category", "by_repo"],
  stub_categories: [
    "use_cases",
    "templates",
    "device_apis",
    "lib_utils",
    "dataclasses",
    "exceptions",
    "fixtures",
    "other",
  ],
};
