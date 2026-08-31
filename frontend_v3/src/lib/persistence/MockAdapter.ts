import type {
  ConfigDoc,
  ConfigFileId,
  PersistenceAdapter,
  SaveResult,
} from "./PersistenceAdapter";
import { SEED } from "./seed";

/** Structured clone with a JSON fallback for older runtimes. */
function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * In-memory persistence backed by the real config seed. Edits survive within a
 * session (so navigating between surfaces keeps changes) but reset on reload —
 * deliberately, since nothing is written to disk yet. Drop-in replaceable by an
 * HttpAdapter implementing the same interface.
 */
export class MockAdapter implements PersistenceAdapter {
  private readonly store: Record<ConfigFileId, ConfigDoc>;

  constructor(seed: Record<ConfigFileId, ConfigDoc> = SEED) {
    this.store = clone(seed);
  }

  async load(file: ConfigFileId): Promise<ConfigDoc> {
    return clone(this.store[file]);
  }

  async save(file: ConfigFileId, doc: ConfigDoc): Promise<SaveResult> {
    // The mock has no Pydantic gate; client-side validation already ran. Real
    // authoritative validation arrives with the HttpAdapter.
    this.store[file] = clone(doc);
    return { ok: true };
  }
}
