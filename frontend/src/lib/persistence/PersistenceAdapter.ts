/**
 * The single seam between the UI and wherever config actually lives. Today a
 * MockAdapter fulfils it entirely in-browser; later an HttpAdapter talks to the
 * existing FastAPI (which imports the real Pydantic models). Swapping adapters
 * changes no UI code.
 */

export type ConfigFileId = "app" | "store" | "search" | "codegen";

/** A parsed TOML document as a plain object tree. */
export type ConfigDoc = Record<string, unknown>;

export interface ValidationIssue {
  /** Dotted location, e.g. "llm.sonnet.model". */
  location: string;
  message: string;
}

export interface SaveResult {
  ok: boolean;
  /** Populated when the authoritative validator (Pydantic, later) rejects. */
  issues?: ValidationIssue[];
}

export interface PersistenceAdapter {
  /** Read the current document for a file. Returns a fresh, mutable copy. */
  load(file: ConfigFileId): Promise<ConfigDoc>;

  /**
   * Persist a document. The caller has already shown the user a diff and
   * confirmed. Returns authoritative validation issues if the backend rejects.
   */
  save(file: ConfigFileId, doc: ConfigDoc): Promise<SaveResult>;
}
