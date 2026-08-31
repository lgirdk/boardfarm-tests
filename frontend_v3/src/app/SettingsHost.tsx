import { useState } from "react";
import { SlideOver } from "@/components/SlideOver";
import { ConfigApp } from "@/modules/config/ConfigApp";
import { SettingsApp } from "@/modules/settings/SettingsApp";
import { cn } from "@/lib/cn";

export interface SettingsHostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SettingsTab = "settings" | "config";

/**
 * V3: The account/settings drawer. Contains user settings (profile, Jira,
 * preferences) and the engine configuration (TOML surfaces). Opened from the
 * AccountPill gear icon. This is NOT an app tile — it's admin-only and does
 * not deserve a tile.
 */
export function SettingsHost({ open, onOpenChange }: SettingsHostProps) {
  const [tab, setTab] = useState<SettingsTab>("settings");

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title="Account & Configuration"
      description="Your profile, integrations, and the orchestrator's engine configuration."
    >
      <div className="flex h-full flex-col">
        {/* Tab strip */}
        <div className="flex gap-1 border-b border-border px-4 pt-1">
          {([
            ["settings", "Settings"],
            ["config", "Engine config"],
          ] as [SettingsTab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "border-b-2 px-3 py-2 text-[12.5px] transition",
                tab === k
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "settings" && <SettingsApp />}
          {tab === "config" && <ConfigApp />}
        </div>
      </div>
    </SlideOver>
  );
}
