import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunEngine } from "@/lib/runs/engine";
import { MockAppsClient } from "./MockAppsClient";

describe("MockAppsClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("generateCode triggers a run that completes with generated code", async () => {
    const engine = new RunEngine({}, 1);
    const client = new MockAppsClient(engine);
    const { run_id } = await client.generateCode({
      name: "wan ipv4 after reboot",
      description: "d",
      preconditions: "p",
      steps: [{ step_num: 1, instruction: "reboot the board" }],
    });

    expect(engine.get(run_id)!.status).toBe("queued");
    vi.advanceTimersByTime(60_000);
    const done = engine.get(run_id)!;
    expect(done.status).toBe("completed");
    const code = done.output?.generated_code;
    expect(typeof code).toBe("string");
    expect(code).toContain("def test_wan_ipv4_after_reboot");
    expect(code).toContain("# Step 1: reboot the board");
  });

  it("planTests completes with an editable TestPlan payload", async () => {
    const engine = new RunEngine({}, 1);
    const client = new MockAppsClient(engine);
    const { run_id } = await client.planTests({
      title: "wan pack",
      source: "free-text",
      scenario: "cover wan",
    });
    vi.advanceTimersByTime(60_000);
    const plan = engine.get(run_id)!.output?.plan as {
      title: string;
      tests: unknown[];
    };
    expect(plan.title).toBe("wan pack");
    expect(plan.tests.length).toBeGreaterThan(0);
  });

  it("analyzeLogs completes with a findings report", async () => {
    const engine = new RunEngine({}, 1);
    const client = new MockAppsClient(engine);
    const { run_id } = await client.analyzeLogs({ logs: "T3 time-out" });
    vi.advanceTimersByTime(60_000);
    const report = engine.get(run_id)!.output?.report as {
      summary: string;
      findings: { severity: string }[];
    };
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.summary).toBeTruthy();
  });

  it("fetchJiraTicket echoes the key and returns preview steps", async () => {
    const engine = new RunEngine({}, 1);
    const client = new MockAppsClient(engine);
    const promise = client.fetchJiraTicket("bf-42");
    vi.advanceTimersByTime(1000);
    const ticket = await promise;
    expect(ticket.key).toBe("BF-42");
    expect(ticket.steps.length).toBeGreaterThan(0);
  });
});
