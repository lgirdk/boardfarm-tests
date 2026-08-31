import type {
  ConfigRecord,
  ConfigSurface,
  ObjectSchema,
} from "@/lib/schema/types";

/**
 * Descriptor data for app.toml's `[llm.<name>]` registry.
 *
 * IMPORTANT modelling note: which client *implementation* handles an entry is
 * chosen by the entry NAME via LLM_REGISTRY in src/orchestrator.py — NOT by the
 * `provider` field, which the backend never reads (it's documentation only).
 * An entry only works if a developer has written a LLMClientTemplate subclass
 * and registered it under that name. So this surface is BOUNDED: users configure
 * the params of existing, registered LLMs; they don't add/rename/remove them
 * (that's a code change). `provider` is therefore shown read-only.
 *
 * Only `model`, `endpoint`, `api_key_env` are read by the clients' from_config().
 */
export const llmItemSchema: ObjectSchema = {
  kind: "object",
  fields: [
    {
      kind: "string",
      key: "provider",
      label: "Provider (interface)",
      readOnly: true,
      description:
        "Documents which client interface backs this entry. Not used by the pipeline and not editable here — the implementation is bound to the entry name in the backend's LLM_REGISTRY.",
    },
    {
      kind: "string",
      key: "model",
      label: "Model",
      required: true,
      placeholder: "claude-sonnet-4-5",
      description:
        "Model identifier passed to the provider, e.g. claude-sonnet-4-5, gpt-4o.",
    },
    {
      kind: "string",
      key: "endpoint",
      label: "Endpoint",
      format: "url",
      placeholder: "http://host:port/v1/",
      description:
        "Base URL for an OpenAI-compatible server. Used by the OpenAI-compatible clients; the Anthropic client ignores it. Leave blank to use the client's default.",
    },
    {
      kind: "string",
      key: "api_key_env",
      label: "API key env var",
      format: "env-var",
      placeholder: "ANTHROPIC_API_KEY",
      description:
        "Name of the environment variable holding the API key (the key value itself is never stored in config).",
    },
  ],
};

/** Starting values for a freshly added LLM entry (unused while bounded). */
export function newLlmRecord(): ConfigRecord {
  return { provider: "", model: "", api_key_env: "" };
}

export const llmProvidersSurface: ConfigSurface = {
  id: "llm-providers",
  file: "app",
  path: "llm",
  title: "LLM Providers",
  description:
    "Configure the parameters of the registered LLMs (app.toml [llm.*]). The set of LLMs is fixed by the backend's client registry — adding a new one requires implementing and registering a client in code.",
  schema: {
    kind: "named-collection",
    keyLabel: "LLM name",
    item: llmItemSchema,
  },
};
