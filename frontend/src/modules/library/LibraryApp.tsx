import { useSearchParams } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";
import { CodegenApp } from "@/modules/codegen/CodegenApp";
import { PlannerApp } from "@/modules/planner/PlannerApp";
import { DraftsApp } from "@/modules/drafts/DraftsApp";
import { TestsTab } from "./TestsTab";
import { SuitesTab } from "./SuitesTab";

type TabId = "tests" | "generate" | "plan" | "drafts" | "suites";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "tests", label: "Tests", hint: "Browse & run the catalog" },
  { id: "generate", label: "Generate", hint: "Create a test with AI" },
  { id: "plan", label: "Plan", hint: "Turn an epic into tests" },
  { id: "drafts", label: "Drafts", hint: "Your private WIP" },
  { id: "suites", label: "Suites", hint: "Named collections" },
];

/**
 * The Library — one home for everything about tests: browse/run the git
 * catalog, generate a missing test, plan from an epic, manage private drafts,
 * and assemble suites. Codegen/planner/drafts live here as tabs instead of
 * separate destinations, so a user never leaves the Library to make a test.
 */
export function LibraryApp() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") as TabId | null;
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "tests";

  function setTab(id: TabId) {
    setParams(
      (prev) => {
        prev.set("tab", id);
        return prev;
      },
      { replace: true },
    );
  }

  return (
    <div className="min-h-full">
      {/* header + tabs */}
      <div className="glow-ambient border-b border-border">
        <div className="px-6 pt-6">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-highlight" />
            <h1 className="text-lg font-semibold tracking-tight">Library</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Browse and run tests, generate the ones you don&apos;t have, and organize
            them into suites — all in one place.
          </p>

          <div className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={cn(
                  "relative whitespace-nowrap rounded-t-[8px] px-3.5 py-2 text-[12.5px] transition",
                  tab === t.id
                    ? "text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-gradient" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* tab content */}
      <div>
        {tab === "tests" && <TestsTab />}
        {tab === "generate" && <CodegenApp />}
        {tab === "plan" && <PlannerApp />}
        {tab === "drafts" && <DraftsApp />}
        {tab === "suites" && <SuitesTab />}
      </div>
    </div>
  );
}
