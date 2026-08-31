import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  Cpu,
  FlaskConical,
  LayoutDashboard,
  Layers,
  PlayCircle,
  ScanText,
  Settings,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { Registry, type RegistryEntry } from "@/lib/registry";
import { DashboardApp } from "@/modules/dashboard/DashboardApp";
import { LibraryApp } from "@/modules/library/LibraryApp";
import { RunsListPage } from "@/modules/runs/RunsListPage";
import { PipelinesApp } from "@/modules/pipelines/PipelinesApp";
import { SchedulesApp } from "@/modules/schedules/SchedulesApp";
import { AnalyzerApp } from "@/modules/analyzer/AnalyzerApp";
import { EnvironmentsApp } from "@/modules/environments/EnvironmentsApp";
import { BedsApp } from "@/modules/beds/BedsApp";
import { SettingsApp } from "@/modules/settings/SettingsApp";
import { ConfigApp } from "@/modules/config/ConfigApp";

/**
 * How an application surfaces in the shell.
 *  - "app":      a routed tenant in the left nav content area.
 *  - "settings": opened from the System section into a slide-over (Config).
 */
export type ApplicationKind = "app" | "settings";

/** Sidebar sections, rendered in this order. */
export type NavSection = "workspace" | "lab" | "system";

export const NAV_SECTIONS: { id: NavSection; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "lab", label: "Lab" },
  { id: "system", label: "System" },
];

export interface Application extends RegistryEntry {
  id: string;
  name: string;
  icon: LucideIcon;
  kind: ApplicationKind;
  section: NavSection;
  /** Route path ("" = the index route). Only for kind "app". */
  path: string;
  Component: ComponentType;
}

/**
 * THE platform registry — the sidebar and router render entirely from it.
 * Adding an app is one entry here; the shell never changes.
 */
export const applicationRegistry = new Registry<Application>(
  "applicationRegistry",
).registerAll([
  {
    id: "overview",
    name: "Overview",
    icon: LayoutDashboard,
    kind: "app",
    section: "workspace",
    path: "",
    Component: DashboardApp,
  },
  {
    id: "library",
    name: "Library",
    icon: FlaskConical,
    kind: "app",
    section: "workspace",
    path: "library",
    Component: LibraryApp,
  },
  {
    id: "runs",
    name: "Runs",
    icon: PlayCircle,
    kind: "app",
    section: "workspace",
    path: "runs",
    Component: RunsListPage,
  },
  {
    id: "pipelines",
    name: "Pipelines",
    icon: Workflow,
    kind: "app",
    section: "workspace",
    path: "pipelines",
    Component: PipelinesApp,
  },
  {
    id: "schedules",
    name: "Schedules",
    icon: CalendarClock,
    kind: "app",
    section: "workspace",
    path: "schedules",
    Component: SchedulesApp,
  },
  {
    id: "analyzer",
    name: "Log analyzer",
    icon: ScanText,
    kind: "app",
    section: "workspace",
    path: "analyzer",
    Component: AnalyzerApp,
  },
  {
    id: "environments",
    name: "Environments",
    icon: Layers,
    kind: "app",
    section: "lab",
    path: "environments",
    Component: EnvironmentsApp,
  },
  {
    id: "boards",
    name: "Boards",
    icon: Cpu,
    kind: "app",
    section: "lab",
    path: "boards",
    Component: BedsApp,
  },
  {
    id: "settings",
    name: "Settings",
    icon: SlidersHorizontal,
    kind: "app",
    section: "system",
    path: "settings",
    Component: SettingsApp,
  },
  {
    id: "config",
    name: "Configuration",
    icon: Settings,
    kind: "settings",
    section: "system",
    path: "",
    Component: ConfigApp,
  },
]);

export function listPrimaryApps(): Application[] {
  return applicationRegistry.list().filter((a) => a.kind === "app");
}

export function listSettingsApps(): Application[] {
  return applicationRegistry.list().filter((a) => a.kind === "settings");
}

export function appsInSection(section: NavSection): Application[] {
  return applicationRegistry.list().filter((a) => a.section === section);
}
