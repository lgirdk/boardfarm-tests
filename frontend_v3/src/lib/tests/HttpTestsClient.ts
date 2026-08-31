import type { TestAsset, TestFilter } from "@/lib/contracts";
import type { TestsClient } from "./TestsClient";

/** GET /api/tests — the backend's git-read catalog. Untested stub. */
export class HttpTestsClient implements TestsClient {
  constructor(private readonly basePath = "/api/tests") {}

  async list(filter?: TestFilter): Promise<TestAsset[]> {
    const params = new URLSearchParams();
    if (filter?.suite) params.set("suite", filter.suite);
    if (filter?.tag) params.set("tag", filter.tag);
    const qs = params.toString();
    const res = await fetch(qs ? `${this.basePath}?${qs}` : this.basePath);
    if (!res.ok) throw new Error(`GET ${this.basePath} failed (HTTP ${res.status})`);
    return (await res.json()) as TestAsset[];
  }
}
