import { describe, expect, it } from "vitest";
import { validateSubCorpusAxes } from "./searchValidation";

describe("validateSubCorpusAxes", () => {
  it("errors when all three selector axes are empty", () => {
    const e = validateSubCorpusAxes({
      categories: [],
      repos: [],
      module_patterns: [],
    });
    expect(e.categories).toMatch(/at least one/i);
  });

  it("passes when any one axis is non-empty", () => {
    expect(
      validateSubCorpusAxes({ categories: ["use_cases"], repos: [], module_patterns: [] }),
    ).toEqual({});
    expect(
      validateSubCorpusAxes({ categories: [], repos: ["boardfarm"], module_patterns: [] }),
    ).toEqual({});
    expect(
      validateSubCorpusAxes({ categories: [], repos: [], module_patterns: ["lan"] }),
    ).toEqual({});
  });

  it("treats missing keys as empty", () => {
    expect(validateSubCorpusAxes({}).categories).toMatch(/at least one/i);
  });
});
