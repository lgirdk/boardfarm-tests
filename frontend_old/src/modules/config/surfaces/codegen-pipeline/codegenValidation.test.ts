import { describe, expect, it } from "vitest";
import { hasStageSettings, validateStage } from "./codegenValidation";
import type { RefResolver } from "@/lib/schema/crossRefs";

const resolver: RefResolver = {
  keysFor: (target) =>
    target === "app.llm"
      ? ["sonnet", "custome_gpt4o"]
      : target === "codegen.profiles"
        ? ["default"]
        : [],
};

const profiles = {
  default: {
    reasoning: { temperature: 0.5, max_tokens: 1536 },
    // NOTE: deliberately missing `search` and `generation` sub-tables
  },
};

describe("hasStageSettings", () => {
  it("is true only when temperature and max_tokens are both present", () => {
    expect(hasStageSettings(profiles.default, "reasoning")).toBe(true);
    expect(hasStageSettings(profiles.default, "search")).toBe(false);
    expect(hasStageSettings(undefined, "reasoning")).toBe(false);
    expect(hasStageSettings({ reasoning: { temperature: 0.5 } }, "reasoning")).toBe(
      false,
    );
  });
});

describe("validateStage", () => {
  it("passes a fully valid stage", () => {
    expect(
      validateStage(
        "reasoning",
        { llm: "sonnet", profile: "default" },
        resolver,
        profiles,
      ),
    ).toEqual({});
  });

  it("flags a dangling LLM reference (#2)", () => {
    const e = validateStage(
      "reasoning",
      { llm: "ghost", profile: "default" },
      resolver,
      profiles,
    );
    expect(e.llm).toContain("app.toml [llm.*]");
  });

  it("flags a dangling profile reference (#3)", () => {
    const e = validateStage(
      "reasoning",
      { llm: "sonnet", profile: "missing" },
      resolver,
      profiles,
    );
    expect(e.profile).toContain("[profiles.*]");
  });

  it("flags a referenced profile missing this stage's sub-table", () => {
    const e = validateStage(
      "search",
      { llm: "sonnet", profile: "default" },
      resolver,
      profiles,
    );
    expect(e.profile).toContain("profiles.default.search");
  });

  it("flags empty required references", () => {
    const e = validateStage("reasoning", {}, resolver, profiles);
    expect(e.llm).toBe("Required");
    expect(e.profile).toBe("Required");
  });
});
