import { describe, expect, it } from "vitest";
import { Registry } from "./registry";

interface Item {
  id: string;
  n: number;
}

describe("Registry", () => {
  it("preserves registration order in list()", () => {
    const r = new Registry<Item>("test").registerAll([
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "c", n: 3 },
    ]);
    expect(r.list().map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(r.size).toBe(3);
  });

  it("throws on duplicate ids so collisions surface early", () => {
    const r = new Registry<Item>("test").register({ id: "a", n: 1 });
    expect(() => r.register({ id: "a", n: 2 })).toThrow(/already registered/);
  });

  it("get/has resolve by id", () => {
    const r = new Registry<Item>("test").register({ id: "a", n: 1 });
    expect(r.has("a")).toBe(true);
    expect(r.get("a")?.n).toBe(1);
    expect(r.get("missing")).toBeUndefined();
  });
});
