import { useState } from "react";
import {
  configSurfaceRegistry,
  groupedConfigSurfaces,
} from "./surfaces/registry";
import { cn } from "@/lib/cn";

/**
 * The Config "settings" application. Its internal sub-nav is grouped by config
 * folder (app.toml / search_store/ / codegen/) so it mirrors the real on-disk
 * layout — keeping codegen's search settings distinct from the Search Store.
 * The shell hosts this inside the settings slide-over; ConfigApp doesn't know that.
 */
export function ConfigApp() {
  const groups = groupedConfigSurfaces();
  const first = groups[0]?.surfaces[0];
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const active = configSurfaceRegistry.get(activeId) ?? first;

  if (!active) return null;
  const Surface = active.Component;

  return (
    <div className="flex h-full">
      <nav className="w-52 shrink-0 overflow-y-auto border-r border-border bg-surface-raised/40 p-2">
        {groups.map((group) => (
          <div key={group.group} className="mb-3">
            <div className="px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted/70">
              {group.group}
            </div>
            {group.surfaces.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "mb-0.5 block w-full rounded-md px-3 py-1.5 text-left text-sm transition",
                  s.id === active.id
                    ? "bg-accent/15 text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <Surface />
      </div>
    </div>
  );
}
