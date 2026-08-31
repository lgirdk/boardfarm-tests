import type { ComponentType } from "react";
import { Registry, type RegistryEntry } from "@/lib/registry";
import { LlmProvidersSurface } from "./llm-providers/LlmProvidersSurface";
import { CodegenPipelineSurface } from "./codegen-pipeline/CodegenPipelineSurface";
import { SearchSettingsSurface } from "./search-settings/SearchSettingsSurface";
import { SearchStoreSurface } from "./search-store/SearchStoreSurface";

/**
 * A config surface = one editable slice of the orchestrator's TOML config. The
 * Config application's internal sub-nav is built from THIS registry — the very
 * same Registry mechanism the shell uses for top-level apps, just at a smaller
 * scope. Adding a surface is one entry here.
 *
 * `group` mirrors the on-disk folder so the nav matches the real layout:
 *   configs/app.toml                       → "app.toml"
 *   configs/search_store/store_config.toml → "search_store/"
 *   configs/codegen/codegen.toml           → "codegen/"
 *   configs/codegen/search.toml            → "codegen/"
 * This keeps the codegen pipeline's search settings (codegen/search.toml)
 * clearly distinct from the separate Search Store (search_store/).
 */
export interface ConfigSurfaceEntry extends RegistryEntry {
  id: string;
  name: string;
  /** Folder label this surface belongs to (drives grouped sub-nav). */
  group: string;
  /** The file shown for this surface, e.g. "configs/codegen/search.toml". */
  file: string;
  Component: ComponentType;
}

export const configSurfaceRegistry = new Registry<ConfigSurfaceEntry>(
  "configSurfaceRegistry",
).registerAll([
  {
    id: "llm-providers",
    name: "LLM Providers",
    group: "app.toml",
    file: "configs/app.toml",
    Component: LlmProvidersSurface,
  },
  {
    id: "search-store",
    name: "Store Config",
    group: "search_store/",
    file: "configs/search_store/store_config.toml",
    Component: SearchStoreSurface,
  },
  {
    id: "codegen-pipeline",
    name: "Pipeline",
    group: "codegen/",
    file: "configs/codegen/codegen.toml",
    Component: CodegenPipelineSurface,
  },
  {
    id: "search-settings",
    name: "Search",
    group: "codegen/",
    file: "configs/codegen/search.toml",
    Component: SearchSettingsSurface,
  },
]);

/** Surfaces grouped by folder, preserving registration order within each group. */
export function groupedConfigSurfaces(): Array<{
  group: string;
  surfaces: ConfigSurfaceEntry[];
}> {
  const groups: Array<{ group: string; surfaces: ConfigSurfaceEntry[] }> = [];
  for (const surface of configSurfaceRegistry.list()) {
    let bucket = groups.find((g) => g.group === surface.group);
    if (!bucket) {
      bucket = { group: surface.group, surfaces: [] };
      groups.push(bucket);
    }
    bucket.surfaces.push(surface);
  }
  return groups;
}
