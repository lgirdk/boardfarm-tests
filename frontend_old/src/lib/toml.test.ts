import { describe, expect, it } from "vitest";
import { parseToml, serializeToml } from "./toml";
import { SEED } from "./persistence/seed";

describe("toml round-trip", () => {
  it("serializes and re-parses the app seed without loss", () => {
    const text = serializeToml(SEED.app);
    const parsed = parseToml(text);
    expect(parsed).toEqual(SEED.app);
  });

  it("drops undefined keys but keeps empty strings", () => {
    const text = serializeToml({
      a: { keep: "", drop: undefined, set: "x" },
    } as Record<string, unknown>);
    const parsed = parseToml(text) as { a: Record<string, unknown> };
    expect(parsed.a.keep).toBe("");
    expect("drop" in parsed.a).toBe(false);
    expect(parsed.a.set).toBe("x");
  });

  it("produces a stable diff anchor (same input → same output)", () => {
    expect(serializeToml(SEED.app)).toBe(serializeToml(SEED.app));
  });
});
