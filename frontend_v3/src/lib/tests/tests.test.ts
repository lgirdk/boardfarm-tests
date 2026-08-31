import { describe, expect, it } from "vitest";
import { MockTestsClient } from "./MockTestsClient";
import { TESTS_SEED } from "./seed";

describe("MockTestsClient", () => {
  it("lists the git catalog as deep clones", async () => {
    const client = new MockTestsClient(undefined, 0);
    const all = await client.list();
    expect(all.length).toBe(TESTS_SEED.length);
    all[0]!.tags.push("rogue");
    const again = await client.list();
    expect(again[0]!.tags).not.toContain("rogue");
  });

  it("filters by suite and by tag", async () => {
    const client = new MockTestsClient(undefined, 0);
    const docsis = await client.list({ suite: "docsis" });
    expect(docsis.length).toBeGreaterThan(0);
    expect(docsis.every((t) => t.suite === "docsis")).toBe(true);

    const wifi = await client.list({ tag: "wifi" });
    expect(wifi.every((t) => t.tags.includes("wifi"))).toBe(true);
  });

  it("every test is git-sourced and carries a suite", () => {
    for (const t of TESTS_SEED) {
      expect(t.source).toBe("git");
      expect(t.suite).toBeTruthy();
    }
  });
});
