import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Code2,
  FileSearch,
  FolderOpen,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  TestTube,
  Workflow,
} from "lucide-react";
import { Registry, type RegistryEntry } from "@/lib/registry";
import { DashboardApp } from "@/modules/dashboard/DashboardApp";
import { CodegenApp } from "@/modules/codegen/CodegenApp";
import { PlannerApp } from "@/modules/planner/PlannerApp";
import { AnalyzerApp } from "@/modules/analyzer/AnalyzerApp";
import { PipelinesApp } from "@/modules/pipelines/PipelinesApp";
import { RunsListPage } from "@/modules/runs/RunsListPage";
import { AvailableTestsApp } from "@/modules/tests/AvailableTestsApp";
import { DraftsApp } from "@/modules/drafts/DraftsApp";
import { ConfigApp } from "@/modules/config/ConfigApp";

/**
 * How an application surfaces in the shell.
 *  - "app":      a routed tenant in the left nav content area.
 *  - "settings": opened from the System section into a slide-over (Config).
 */
export type ApplicationKind = "app" | "settings";

/** Sidebar sections, rendered in this order. */
export type NavSection = "apps" | "automation" | "library" | "system";

export const NAV_SECTIONS: { id: NavSection; label: string }[] = [
  { id: "apps", label: "Apps" },
  { id: "automation", label: "Automation" },
  { id: "library", label: "Library" },
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
    id: "dashboard",
    name: "Dashboard",
    icon: LayoutDashboard,
    kind: "app",
    section: "apps",
    path: "",
    Component: DashboardApp,
  },
  {
    id: "codegen",
    name: "Codegen",
    icon: Code2,
    kind: "app",
    section: "apps",
    path: "codegen",
    Component: CodegenApp,
  },
  {
    id: "planner",
    name: "Test planner",
    icon: ListChecks,
    kind: "app",
    section: "apps",
    path: "planner",
    Component: PlannerApp,
  },
  {
    id: "analyzer",
    name: "Log analyzer",
    icon: FileSearch,
    kind: "app",
    section: "apps",
    path: "analyzer",
    Component: AnalyzerApp,
  },
  {
    id: "pipelines",
    name: "Pipelines",
    icon: Workflow,
    kind: "app",
    section: "automation",
    path: "pipelines",
    Component: PipelinesApp,
  },
  {
    id: "runs",
    name: "Runs",
    icon: History,
    kind: "app",
    section: "automation",
    path: "runs",
    Component: RunsListPage,
  },
  {
    id: "tests",
    name: "Available tests",
    icon: TestTube,
    kind: "app",
    section: "library",
    path: "tests",
    Component: AvailableTestsApp,
  },
  {
    id: "drafts",
    name: "Drafts",
    icon: FolderOpen,
    kind: "app",
    section: "library",
    path: "drafts",
    Component: DraftsApp,
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
