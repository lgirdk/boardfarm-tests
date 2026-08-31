import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarClock,

  FlaskConical,
  FolderOpen,
  Layers,
  ListChecks,
  PlayCircle,
  ScanText,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { LibraryApp } from "@/modules/library/LibraryApp";
import { RunsListPage } from "@/modules/runs/RunsListPage";
import { BedsApp } from "@/modules/beds/BedsApp";
import { SchedulesApp } from "@/modules/schedules/SchedulesApp";
import { PipelinesApp } from "@/modules/pipelines/PipelinesApp";
import { AnalyzerApp } from "@/modules/analyzer/AnalyzerApp";

/* ─── V3 Section ──────────────────────────────────────────────────── */
export interface AppSection {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Badge count shown next to the label, e.g. "2,441" */
  count?: string;
}

/* ─── V3 App definition ──────────────────────────────────────────── */
export interface V3App {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  sub: string;
  count: string;
  foot: string;
  sections: AppSection[];
  Component: ComponentType;
}

export const V3_APPS: V3App[] = [
  {
    id: "library",
    name: "Test lab",
    icon: BookOpen,
    color: "124,140,255",
    sub: "Browse tests, generate new ones, plan coverage, manage drafts and suites.",
    count: "2,441",
    foot: "3 drafts waiting on you",
    sections: [
      { id: "tests", label: "Tests", icon: BookOpen, count: "2,441" },
      { id: "generate", label: "Generate", icon: Sparkles },
      { id: "plan", label: "Plan", icon: ListChecks },
      { id: "drafts", label: "Drafts", icon: FolderOpen, count: "3" },
      { id: "suites", label: "Suites", icon: Layers, count: "3" },
    ],
    Component: LibraryApp,
  },
  {
    id: "runs",
    name: "Executions",
    icon: PlayCircle,
    color: "90,169,255",
    sub: "What is running now, what ran, and what failed.",
    count: "2",
    foot: "2 in flight · 1 needs approval",
    sections: [
      { id: "activity", label: "Activity", icon: PlayCircle, count: "2" },
    ],
    Component: RunsListPage,
  },
  {
    id: "lab",
    name: "Inventory",
    icon: FlaskConical,
    color: "45,212,191",
    sub: "Boards, their live status, and the provisioning environments they run with.",
    count: "7",
    foot: "7 of 10 boards free",
    sections: [
      { id: "boards", label: "Boards", icon: FlaskConical, count: "10" },
      { id: "envs", label: "Environments", icon: Layers, count: "6" },
    ],
    Component: BedsApp,
  },
  {
    id: "schedules",
    name: "Schedules",
    icon: CalendarClock,
    color: "255,197,90",
    sub: "Unattended runs on a clock.",
    count: "3",
    foot: "nightly-sanity in 6h 12m",
    sections: [
      { id: "all", label: "All schedules", icon: CalendarClock, count: "3" },
    ],
    Component: SchedulesApp,
  },
  {
    id: "pipelines",
    name: "Pipelines",
    icon: Workflow,
    color: "167,139,250",
    sub: "Ticket to reviewed test, running on a board.",
    count: "3",
    foot: "41 runs this month",
    sections: [{ id: "all", label: "Workflows", icon: Workflow, count: "3" }],
    Component: PipelinesApp,
  },
  {
    id: "analyzer",
    name: "Log analyzer",
    icon: ScanText,
    color: "240,171,252",
    sub: "Paste a log from anywhere and find the cause.",
    count: "",
    foot: "also runs inline on failed steps",
    sections: [
      { id: "paste", label: "Paste a log", icon: ScanText },
      { id: "fromrun", label: "From a past run", icon: PlayCircle },
      { id: "upload", label: "Upload a file", icon: Upload },
    ],
    Component: AnalyzerApp,
  },
];

export function getApp(id: string): V3App | undefined {
  return V3_APPS.find((a) => a.id === id);
}

