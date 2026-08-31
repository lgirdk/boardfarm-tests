import type {
  ConfigDoc,
  ConfigFileId,
  PersistenceAdapter,
  SaveResult,
} from "./PersistenceAdapter";
import { SEED } from "./seed";

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * A mock that *simulates* the real HTTP adapter — same data as MockAdapter,
 * but every call returns via a promise resolved after a short delay so the UI
 * exercises loading / saving spinners realistically.
 *
 * Useful for visually verifying that load / save states render correctly
 * without standing up the real backend. Activate by editing
 * src/lib/persistence/index.ts to construct this instead of `MockAdapter`.
 */
export class MockHttpAdapter implements PersistenceAdapter {
  private readonly store: Record<ConfigFileId, ConfigDoc>;

  constructor(
    seed: Record<ConfigFileId, ConfigDoc> = SEED,
    private readonly latencyMs = 300,
  ) {
    this.store = clone(seed);
  }

  async load(file: ConfigFileId): Promise<ConfigDoc> {
    await this._delay();
    return clone(this.store[file]);
  }

  async save(file: ConfigFileId, doc: ConfigDoc): Promise<SaveResult> {
    await this._delay();
    this.store[file] = clone(doc);
    return { ok: true };
  }

  private _delay(): Promise<void> {
    return new Promise((r) => setTimeout(r, this.latencyMs));
  }
}
