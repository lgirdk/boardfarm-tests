import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SettingsHost } from "./SettingsHost";

/**
 * The persistent platform frame: sidebar + swappable content outlet (on the
 * dot-grid canvas) + the settings slide-over host. Owns only chrome-level UI
 * state (is settings open).
 */
export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-canvas bg-dotgrid">
        <Outlet />
      </main>

      <SettingsHost open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
