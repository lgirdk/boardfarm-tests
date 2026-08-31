import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SettingsHost } from "./SettingsHost";
import { SelectionTray } from "@/modules/runs/SelectionTray";
import { LaunchComposer } from "@/modules/runs/LaunchComposer";
import { TestDetailDrawer } from "@/modules/library/TestDetailDrawer";

/**
 * The persistent platform frame: sidebar + swappable content outlet (on the
 * dot-grid canvas) + the settings slide-over host. The selection tray docks at
 * the bottom of the content area; the test-detail and run-composer drawers
 * overlay everything and persist across navigation.
 */
export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <div className="relative min-w-0 flex-1">
        <main className="h-full overflow-y-auto bg-canvas bg-dotgrid">
          <Outlet />
        </main>
        <SelectionTray />
      </div>

      <SettingsHost open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TestDetailDrawer />
      <LaunchComposer />
    </div>
  );
}
