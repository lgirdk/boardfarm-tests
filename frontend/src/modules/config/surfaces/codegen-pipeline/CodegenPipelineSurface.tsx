import { useState } from "react";
import { useConfigDoc } from "../../useConfigDoc";
import { SaveBar } from "../../SaveBar";
import { getAtPath, setAtPath } from "@/lib/objectPath";
import { cn } from "@/lib/cn";
import { useRegistries } from "@/lib/registries";
import { StagesEditor } from "./StagesEditor";
import { ProfilesEditor } from "./ProfilesEditor";
import type { ConfigRecord } from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;
type Tab = "stages" | "profiles";

/**
 * Codegen Pipeline surface (codegen.toml). Two sections: the fixed pipeline
 * Stages (each referencing an LLM + a profile) and the open set of Profiles
 * (per-stage temperature/max_tokens). It also loads app.toml read-only to offer
 * the LLM names as reference options.
 *
 * LLM reference options are the intersection of the names configured in
 * app.toml AND the names registered in the backend (via /api/registries),
 * since both are required for a stage to actually run.
 */
export function CodegenPipelineSurface() {
  const codegen = useConfigDoc("codegen");
  const app = useConfigDoc("app"); // read-only here, just for llm reference keys
  const { registries } = useRegistries();
  const [tab, setTab] = useState<Tab>("stages");

  if (codegen.loading || !codegen.working || app.loading || !app.working) {
    return <p className="px-1 py-6 text-sm text-muted">Loading…</p>;
  }

  const stages = (getAtPath(codegen.working, "stages") as NamedMap) ?? {};
  const profiles = (getAtPath(codegen.working, "profiles") as NamedMap) ?? {};
  const configuredLlmKeys = Object.keys(
    (getAtPath(app.working, "llm") as NamedMap) ?? {},
  );
  const registeredLlmNames = new Set(
    registries.llm_clients.map((c) => c.name),
  );
  // A stage's LLM must be BOTH configured in app.toml AND registered in the
  // backend's LLM_CLIENT_REGISTRY. Show only the intersection so users can't
  // pick a name that would fail at runtime.
  const llmKeys = configuredLlmKeys.filter((k) => registeredLlmNames.has(k));
  const profileKeys = Object.keys(profiles);

  function update(path: string, value: unknown) {
    codegen.setWorking(setAtPath(codegen.working!, path, value));
  }

  return (
    <div className="flex flex-col">
      <header className="mb-5">
        <h2 className="text-base font-semibold">Codegen Pipeline</h2>
        <p className="mt-1 text-sm text-muted">
          Map each pipeline stage to an LLM and a profile, and tune the profiles'
          per-stage settings (configs/codegen/codegen.toml).
        </p>
      </header>

      <div className="mb-5 inline-flex gap-1 rounded-md border border-border p-0.5">
        {(["stages", "profiles"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded px-3 py-1.5 text-sm capitalize transition",
              tab === t
                ? "bg-accent/15 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "stages" ? (
        <StagesEditor
          stages={stages}
          profiles={profiles}
          llmKeys={llmKeys}
          profileKeys={profileKeys}
          onChange={(next) => update("stages", next)}
        />
      ) : (
        <ProfilesEditor
          profiles={profiles}
          stageNames={Object.keys(stages)}
          onChange={(next) => update("profiles", next)}
        />
      )}

      <SaveBar doc={codegen} fileName="configs/codegen/codegen.toml" />
    </div>
  );
}
