import type { TestSuite } from "@/lib/contracts";
import type { SuitesClient } from "./SuitesClient";
import { SUITES_SEED } from "./seed";

/** In-browser suite store (mutable, deep-cloned from the seed). */
export class MockSuitesClient implements SuitesClient {
  private store: TestSuite[];

  constructor(seed: TestSuite[] = SUITES_SEED, private readonly delayMs = 100) {
    this.store = structuredClone(seed);
  }

  private async delay() {
    if (this.delayMs > 0) await new Promise((r) => setTimeout(r, this.delayMs));
  }

  async list(): Promise<TestSuite[]> {
    await this.delay();
    return structuredClone(this.store).sort((a, b) => b.updated_at - a.updated_at);
  }

  async get(id: string): Promise<TestSuite | undefined> {
    await this.delay();
    const found = this.store.find((s) => s.id === id);
    return found ? structuredClone(found) : undefined;
  }

  async save(suite: TestSuite): Promise<TestSuite> {
    await this.delay();
    const next = { ...suite, updated_at: Date.now() };
    const idx = this.store.findIndex((s) => s.id === suite.id);
    if (idx >= 0) this.store[idx] = next;
    else this.store.unshift(next);
    return structuredClone(next);
  }

  async remove(id: string): Promise<void> {
    await this.delay();
    this.store = this.store.filter((s) => s.id !== id);
  }
}
