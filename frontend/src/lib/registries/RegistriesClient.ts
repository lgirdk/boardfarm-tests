/**
 * The single seam between the UI and the backend's code-derived registries.
 *
 * Today an in-browser MockRegistriesClient fulfils it entirely; later an
 * HttpRegistriesClient hits GET /api/registries. Swapping clients changes no
 * UI code.
 *
 * See frontend/docs/BACKEND_API_CONTRACT.md §3.1 for the endpoint contract.
 */

/** One registered LLM client class (matches backend's LLM_CLIENT_REGISTRY). */
export interface LlmClientEntry {
  /** The TOML [llm.<name>] key — must match this when configuring. */
  name: string;
  /** Backend class name (informational, shown in tooltips). */
  client_class: string;
  /** Provider family (informational, shown as a badge). */
  provider: string;
}

/**
 * All code-derived enumerations the UI consumes. Every field corresponds to
 * something the backend cannot avoid knowing — a registry, an enum, or a
 * `Literal` arm of a Pydantic discriminator.
 */
export interface Registries {
  llm_clients: LlmClientEntry[];
  encoder_types: string[];
  search_filters: string[];
  codegen_stages: string[];
  prompt_variants: string[];
  output_types: string[];
  include_strategies: string[];
  stub_categories: string[];
}

export interface RegistriesClient {
  /** Fetch the full registries catalog. Rejects on transport / 5xx. */
  fetch(): Promise<Registries>;
}
