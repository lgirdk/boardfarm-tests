import { SlideOver } from "@/components/SlideOver";
import { listSettingsApps } from "./registry";

export interface SettingsHostProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Hosts settings-kind applications (today: Config) inside a slide-over, so they
 * never occupy a primary nav slot. Renders the first registered settings app;
 * if several existed later, this is where a small tab strip would go.
 */
export function SettingsHost({ open, onOpenChange }: SettingsHostProps) {
  const settingsApps = listSettingsApps();
  const app = settingsApps[0];
  if (!app) return null;

  const App = app.Component;
  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={app.name}
      description="Edit the orchestrator's TOML configuration. Changes are previewed before save."
    >
      <App />
    </SlideOver>
  );
}
