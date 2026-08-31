import { describe, expect, it } from "vitest";
import { validateRef, type RefResolver } from "./crossRefs";

const resolver: RefResolver = {
  keysFor: (target) =>
    target === "app.llm"
      ? ["sonnet", "custome_gpt4o"]
      : target === "codegen.profiles"
        ? ["default"]
        : ["bge_small", "openai_small"], // store.encoders
};

describe("validateRef", () => {
  it("passes when the value exists in the target collection", () => {
    expect(
      validateRef("sonnet", "app.llm", "stages.reasoning.llm", resolver),
    ).toBeNull();
  });

  it("ignores empty values (handled by required separately)", () => {
    expect(validateRef("", "app.llm", "stages.x.llm", resolver)).toBeNull();
  });

  it("reports a dangling reference with the target file and available keys", () => {
    const err = validateRef(
      "gpt5",
      "app.llm",
      "stages.reasoning.llm",
      resolver,
    );
    expect(err).not.toBeNull();
    expect(err!.location).toBe("stages.reasoning.llm");
    expect(err!.message).toContain("app.toml [llm.*]");
    expect(err!.message).toContain("sonnet");
  });

  it("validates the encoder cross-file reference (#1)", () => {
    expect(
      validateRef("bge_small", "store.encoders", "encoder", resolver),
    ).toBeNull();
    expect(
      validateRef("missing", "store.encoders", "encoder", resolver),
    ).not.toBeNull();
  });
});
