import type {
  ConfigDoc,
  ConfigFileId,
  PersistenceAdapter,
  SaveResult,
  ValidationIssue,
} from "./PersistenceAdapter";

/**
 * Real-backend adapter. Talks to:
 *   GET  /api/config/{file_id}   → returns the parsed TOML as JSON
 *   POST /api/config/{file_id}   → { ok: true } | { ok: false, issues: [...] }
 *
 * See frontend/docs/BACKEND_API_CONTRACT.md §3.1 for the exact contract.
 * In dev, Vite proxies `/api` to http://localhost:8080 (see vite.config.ts).
 */
export class HttpAdapter implements PersistenceAdapter {
  constructor(private readonly basePath = "/api/config") {}

  async load(file: ConfigFileId): Promise<ConfigDoc> {
    const res = await fetch(`${this.basePath}/${file}`);
    if (!res.ok) {
      throw new Error(
        `Failed to load config '${file}' (HTTP ${res.status}): ${await safeText(res)}`,
      );
    }
    return (await res.json()) as ConfigDoc;
  }

  async save(file: ConfigFileId, doc: ConfigDoc): Promise<SaveResult> {
    const res = await fetch(`${this.basePath}/${file}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(doc),
    });

    // The backend contract: validation failures return 200 OK with
    // {ok:false, issues:[...]} — they're expected user errors, not server faults.
    if (res.ok) {
      const body = (await res.json()) as {
        ok: boolean;
        issues?: ValidationIssue[];
      };
      return body.ok ? { ok: true } : { ok: false, issues: body.issues ?? [] };
    }

    // Non-2xx: a real server error — surface it.
    throw new Error(
      `Failed to save config '${file}' (HTTP ${res.status}): ${await safeText(res)}`,
    );
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return "(no body)";
  }
}
