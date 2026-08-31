import type { TestAsset, TestFilter } from "@/lib/contracts";
import type { TestsClient } from "./TestsClient";
import { TESTS_SEED } from "./seed";

/** In-browser git catalog (deep-cloned so callers can't mutate the seed). */
export class MockTestsClient implements TestsClient {
  constructor(
    private readonly seed: TestAsset[] = TESTS_SEED,
    private readonly delayMs = 120,
  ) {}

  async list(filter?: TestFilter): Promise<TestAsset[]> {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
    let all = structuredClone(this.seed);
    if (filter?.suite) all = all.filter((t) => t.suite === filter.suite);
    if (filter?.tag) all = all.filter((t) => t.tags.includes(filter.tag!));
    return all;
  }
}
