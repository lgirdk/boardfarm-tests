/**
 * Generic ordered registry.
 *
 * This is the single registration mechanism reused everywhere a list of
 * pluggable, named things needs to be declared once and consumed elsewhere:
 *   - the platform shell's top-level applications (Dashboard, Config, and later
 *     Log Analyzer / Debugger / Search Playground), and
 *   - the Config application's internal sub-surfaces (LLM Providers, Search
 *     Store, ...).
 *
 * Adding a new entry is a `register()` call, never an edit to a switch
 * statement or a hardcoded array spread across the shell.
 */

export interface RegistryEntry {
  /** Stable, URL-safe identifier. Unique within a registry. */
  id: string;
}

export class Registry<T extends RegistryEntry> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly label: string) {}

  /** Register an entry. Throws on duplicate id so collisions surface early. */
  register(entry: T): this {
    if (this.entries.has(entry.id)) {
      throw new Error(
        `${this.label}: an entry with id "${entry.id}" is already registered`,
      );
    }
    this.entries.set(entry.id, entry);
    return this;
  }

  /** Register many entries in order. */
  registerAll(entries: readonly T[]): this {
    for (const entry of entries) this.register(entry);
    return this;
  }

  get(id: string): T | undefined {
    return this.entries.get(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Insertion-ordered list of all entries. */
  list(): T[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }
}
