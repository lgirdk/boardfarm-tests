import type { TestSuite } from "@/lib/contracts";

/**
 * Saved test suites (named collections assembled in the Library). Mock is an
 * in-memory store; the backend will persist these per workspace.
 */
export interface SuitesClient {
  list(): Promise<TestSuite[]>;
  get(id: string): Promise<TestSuite | undefined>;
  /** Create or update. */
  save(suite: TestSuite): Promise<TestSuite>;
  remove(id: string): Promise<void>;
}
