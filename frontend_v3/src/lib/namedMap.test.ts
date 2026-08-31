import { describe, expect, it } from "vitest";
import {
  addEntry,
  removeEntry,
  renameEntry,
  uniqueName,
  validateKey,
} from "./namedMap";

const base = { sonnet: { x: 1 }, gpt: { x: 2 } };

describe("uniqueName", () => {
  it("returns the base when free", () => {
    expect(uniqueName(base, "claude")).toBe("claude");
  });
  it("suffixes on collision", () => {
    expect(uniqueName({ new_entry: {}, new_entry_2: {} }, "new_entry")).toBe(
      "new_entry_3",
    );
  });
});

describe("add/remove", () => {
  it("adds without mutating the original", () => {
    const next = addEntry(base, "claude", { x: 3 });
    expect(Object.keys(next)).toEqual(["sonnet", "gpt", "claude"]);
    expect(Object.keys(base)).toEqual(["sonnet", "gpt"]);
  });
  it("removes a key", () => {
    expect(Object.keys(removeEntry(base, "sonnet"))).toEqual(["gpt"]);
  });
});

describe("renameEntry", () => {
  it("preserves insertion order while swapping the key", () => {
    const next = renameEntry(base, "sonnet", "claude");
    expect(Object.keys(next)).toEqual(["claude", "gpt"]);
    expect(next.claude).toEqual({ x: 1 });
  });
  it("is a no-op when renaming to the same name or a missing key", () => {
    expect(renameEntry(base, "sonnet", "sonnet")).toBe(base);
    expect(renameEntry(base, "nope", "x")).toBe(base);
  });
});

describe("validateKey", () => {
  it("rejects empty, bad chars, and duplicates", () => {
    expect(validateKey(base, "", null)).toMatch(/required/i);
    expect(validateKey(base, "has space", null)).toMatch(/letters/i);
    expect(validateKey(base, "gpt", null)).toMatch(/already exists/);
  });
  it("allows keeping the current name during rename", () => {
    expect(validateKey(base, "gpt", "gpt")).toBeNull();
    expect(validateKey(base, "claude", "sonnet")).toBeNull();
  });
});
