import type { TestSuite } from "@/lib/contracts";
import type { SuitesClient } from "./SuitesClient";

/**
 * /api/suites — see BACKEND_API_CONTRACT.md. Untested stub; wire when the
 * backend suite persistence is ready.
 */
export class HttpSuitesClient implements SuitesClient {
  constructor(private readonly basePath = "/api/suites") {}

  async list(): Promise<TestSuite[]> {
    const res = await fetch(this.basePath);
    if (!res.ok) throw new Error(`GET suites failed (HTTP ${res.status})`);
    return (await res.json()) as TestSuite[];
  }

  async get(id: string): Promise<TestSuite | undefined> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`GET suite failed (HTTP ${res.status})`);
    return (await res.json()) as TestSuite;
  }

  async save(suite: TestSuite): Promise<TestSuite> {
    const res = await fetch(this.basePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(suite),
    });
    if (!res.ok) throw new Error(`Save suite failed (HTTP ${res.status})`);
    return (await res.json()) as TestSuite;
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${this.basePath}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Delete suite failed (HTTP ${res.status})`);
  }
}
