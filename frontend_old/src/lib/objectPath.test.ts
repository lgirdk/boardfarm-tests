import { describe, expect, it } from "vitest";
import { getAtPath, setAtPath } from "./objectPath";

describe("objectPath", () => {
  const tree = { llm: { sonnet: { model: "x" } }, top: 1 };

  it("reads nested and top-level paths", () => {
    expect(getAtPath(tree, "llm")).toEqual({ sonnet: { model: "x" } });
    expect(getAtPath(tree, "top")).toBe(1);
    expect(getAtPath(tree, "")).toBe(tree);
    expect(getAtPath(tree, "missing.deep")).toBeUndefined();
  });

  it("sets without mutating the source", () => {
    const next = setAtPath(tree, "llm", { gpt: {} });
    expect(next.llm).toEqual({ gpt: {} });
    expect(tree.llm).toEqual({ sonnet: { model: "x" } });
  });
});
