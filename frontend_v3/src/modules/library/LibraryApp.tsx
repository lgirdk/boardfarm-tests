import { useLocation, useSearchParams } from "react-router-dom";
import { CodegenApp } from "@/modules/codegen/CodegenApp";
import { PlannerApp } from "@/modules/planner/PlannerApp";
import { DraftsApp } from "@/modules/drafts/DraftsApp";
import { TestsTab } from "./TestsTab";
import { SuitesTab } from "./SuitesTab";

type TabId = "tests" | "generate" | "plan" | "drafts" | "suites";

const VALID_TABS: TabId[] = ["tests", "generate", "plan", "drafts", "suites"];

/**
 * The Library — one home for everything about tests: browse/run the git
 * catalog, generate a missing test, plan from an epic, manage private drafts,
 * and assemble suites.
 *
 * V3: sections are driven by the URL path (/library/generate, /library/plan…).
 * The section tier handles navigation; LibraryApp just reads the location.
 * Falls back to ?tab= query param for backward compat (e.g. navigate("/library?tab=suites")).
 */
export function LibraryApp() {
  const location = useLocation();
  const [params] = useSearchParams();

  // Determine active tab from URL path or ?tab= query param
  const pathParts = location.pathname.split("/").filter(Boolean);
  const pathSection = pathParts[1] as TabId | undefined;
  const queryTab = params.get("tab") as TabId | null;

  let tab: TabId = "tests";
  if (pathSection && VALID_TABS.includes(pathSection)) {
    tab = pathSection;
  } else if (queryTab && VALID_TABS.includes(queryTab)) {
    tab = queryTab;
  }

  return (
    <div className="min-h-full">
      {tab === "tests" && <TestsTab />}
      {tab === "generate" && <CodegenApp />}
      {tab === "plan" && <PlannerApp />}
      {tab === "drafts" && <DraftsApp />}
      {tab === "suites" && <SuitesTab />}
    </div>
  );
}
