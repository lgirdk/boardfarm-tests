import { useMemo } from "react";
import { useConfigDoc } from "../../useConfigDoc";
import { NamedCollectionEditor } from "../../NamedCollectionEditor";
import { SaveBar } from "../../SaveBar";
import {
  llmItemSchema,
  llmProvidersSurface,
  newLlmRecord,
} from "@/schemas/app.schema";
import { getAtPath, setAtPath } from "@/lib/objectPath";
import { useRegistries } from "@/lib/registries";
import type { ConfigRecord } from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;

/**
 * The first fully-working config surface: edits app.toml's `[llm.*]` registry.
 * It's intentionally thin — load the doc, hand the `llm` table to the generic
 * NamedCollectionEditor, gate save behind the diff. No bespoke form code here.
 *
 * Uses the backend registries to surface mismatches between what's configured
 * in app.toml and what the backend has registered as LLM client classes.
 */
export function LlmProvidersSurface() {
  const doc = useConfigDoc(llmProvidersSurface.file);
  const { registries, loading: registriesLoading, error: registriesError } =
    useRegistries();

  const llm = (getAtPath(doc.working ?? {}, llmProvidersSurface.path) as NamedMap) ?? {};

  /**
   * Cross-check: which registered LLM names are NOT configured in app.toml,
   * and which configured names are NOT registered with the backend. Both
   * mean the entry won't work at runtime.
   */
  const mismatches = useMemo(() => {
    const registeredNames = new Set(registries.llm_clients.map((c) => c.name));
    const configuredNames = new Set(Object.keys(llm));
    return {
      missingConfig: [...registeredNames].filter((n) => !configuredNames.has(n)),
      unknownToBackend: [...configuredNames].filter(
        (n) => !registeredNames.has(n),
      ),
    };
  }, [llm, registries]);

  if (doc.loading || !doc.working) {
    return <p className="px-1 py-6 text-sm text-muted">Loading…</p>;
  }

  function handleChange(next: NamedMap) {
    doc.setWorking(setAtPath(doc.working!, llmProvidersSurface.path, next));
  }

  return (
    <div className="flex flex-col">
      <header className="mb-5">
        <h2 className="text-base font-semibold">{llmProvidersSurface.title}</h2>
        <p className="mt-1 text-sm text-muted">{llmProvidersSurface.description}</p>
      </header>

      {registriesError && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Backend registries unavailable — using fallback data.{" "}
          <span className="opacity-70">({registriesError})</span>
        </div>
      )}

      {!registriesLoading && mismatches.missingConfig.length > 0 && (
        <div className="mb-2 rounded-md border border-border bg-surface-raised/50 px-3 py-2 text-xs text-muted">
          Registered LLMs not configured here:{" "}
          {mismatches.missingConfig.map((n) => (
            <code key={n} className="ml-1 font-mono text-foreground/80">
              {n}
            </code>
          ))}
        </div>
      )}

      {!registriesLoading && mismatches.unknownToBackend.length > 0 && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          Configured but not in backend registry:{" "}
          {mismatches.unknownToBackend.map((n) => (
            <code key={n} className="ml-1 font-mono">
              {n}
            </code>
          ))}{" "}
          — these will fail at runtime.
        </div>
      )}

      <NamedCollectionEditor
        value={llm}
        itemSchema={llmItemSchema}
        keyLabel="LLM"
        newRecord={newLlmRecord}
        onChange={handleChange}
        canAdd={false}
        canRename={false}
        canRemove={false}
      />

      <SaveBar doc={doc} fileName="configs/app.toml" />
    </div>
  );
}
