import { describe, expect, it } from "vitest";
import { MockWorkflowsClient } from "./MockWorkflowsClient";
import { MOCK_BEHAVIOR, WORKFLOWS_SEED } from "./seed";

describe("MockWorkflowsClient", () => {
  it("lists the seeded workflows as deep clones", async () => {
    const client = new MockWorkflowsClient(undefined, 0);
    const list = await client.list();
    expect(list.map((w) => w.name)).toEqual(WORKFLOWS_SEED.map((w) => w.name));
    list[0]!.steps.push({ name: "rogue", title: "Rogue" });
    const again = await client.list();
    expect(again[0]!.steps.find((s) => s.name === "rogue")).toBeUndefined();
  });

  it("gets a workflow by name and null for unknown", async () => {
    const client = new MockWorkflowsClient(undefined, 0);
    expect((await client.get("nightly-sanity"))?.title).toBe("Nightly sanity");
    expect(await client.get("nope")).toBeNull();
  });
});

describe("workflow seed invariants", () => {
  it("has at least one workflow with an approval step and one fully unattended", () => {
    const approvals = (name: string) =>
      WORKFLOWS_SEED.find((w) => w.name === name)!.steps.filter(
        (s) => s.approval,
      ).length;
    // Some workflows gate on human review; nightly runs unattended (no gates).
    expect(WORKFLOWS_SEED.some((w) => w.steps.some((s) => s.approval))).toBe(true);
    expect(approvals("nightly-sanity")).toBe(0);
  });

  it("exactly one workflow is configured to fail at a MIDDLE step", () => {
    const failing = Object.entries(MOCK_BEHAVIOR).filter(([, b]) => b.failAtStep);
    expect(failing).toHaveLength(1);
    const [name, behavior] = failing[0]!;
    const steps = WORKFLOWS_SEED.find((w) => w.name === name)!.steps.map(
      (s) => s.name,
    );
    const index = steps.indexOf(behavior.failAtStep!);
    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(steps.length - 1);
  });

  it("every behavior step maps to a real workflow step", () => {
    for (const [name, behavior] of Object.entries(MOCK_BEHAVIOR)) {
      const stepNames = new Set(
        WORKFLOWS_SEED.find((w) => w.name === name)!.steps.map((s) => s.name),
      );
      for (const key of Object.keys(behavior.steps)) {
        expect(stepNames.has(key), `${name}.${key}`).toBe(true);
      }
    }
  });
});
