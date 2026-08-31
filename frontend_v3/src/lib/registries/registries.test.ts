import { describe, expect, it } from "vitest";
import { MockRegistriesClient } from "./MockRegistriesClient";
import { REGISTRIES_SEED } from "./seed";

describe("MockRegistriesClient", () => {
  it("returns the seeded catalog", async () => {
    const client = new MockRegistriesClient(undefined, 0);
    const data = await client.fetch();
    expect(data).toEqual(REGISTRIES_SEED);
  });

  it("returns a fresh deep-cloned copy (mutating it must not affect the seed)", async () => {
    const client = new MockRegistriesClient(undefined, 0);
    const first = await client.fetch();
    first.llm_clients.push({
      name: "rogue",
      client_class: "Rogue",
      provider: "x",
    });
    const second = await client.fetch();
    expect(second.llm_clients.find((c) => c.name === "rogue")).toBeUndefined();
  });

  it("respects an injected seed", async () => {
    const tiny = {
      ...REGISTRIES_SEED,
      llm_clients: [
        { name: "only_one", client_class: "Only", provider: "test" },
      ],
    };
    const client = new MockRegistriesClient(tiny, 0);
    const data = await client.fetch();
    expect(data.llm_clients).toEqual(tiny.llm_clients);
  });
});

describe("REGISTRIES_SEED shape", () => {
  it("contains every required key in the Registries interface", () => {
    const keys = Object.keys(REGISTRIES_SEED).sort();
    expect(keys).toEqual(
      [
        "codegen_stages",
        "encoder_types",
        "include_strategies",
        "llm_clients",
        "output_types",
        "prompt_variants",
        "search_filters",
        "stub_categories",
      ].sort(),
    );
  });

  it("llm_clients entries match the real LLM_CLIENT_REGISTRY", () => {
    const names = REGISTRIES_SEED.llm_clients.map((c) => c.name).sort();
    expect(names).toEqual(
      ["custome_gpt4o", "gemma4_26B_8bit", "openai_llm", "sonnet"].sort(),
    );
  });

  it("encoder_types match the backend's _EncoderEntry discriminator arms", () => {
    expect(REGISTRIES_SEED.encoder_types).toEqual([
      "sentence_transformer",
      "openai",
    ]);
  });

  it("codegen_stages match the backend's ResolvedPipeline.stage_names()", () => {
    expect(REGISTRIES_SEED.codegen_stages).toEqual([
      "reasoning",
      "search",
      "generation",
    ]);
  });
});
