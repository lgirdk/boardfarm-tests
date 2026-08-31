import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Play, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { JobProgress } from "@/components/JobProgress";
import { appsClient } from "@/lib/apps";
import { artifactsClient } from "@/lib/artifacts";
import { useAuth } from "@/lib/auth";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import { setCodegenPrefill } from "@/lib/handoff";
import type { PlannedTest, TestPlan } from "@/lib/contracts";
import { cn } from "@/lib/cn";

type Source = "free-text" | "jira-epic";

/**
 * Test planner: scenario (or Jira epic) in → editable plan out. Each planned
 * test is an editable card; a card can be saved as a draft artifact or handed
 * to codegen through the typed CodegenPrefill contract.
 */
export function PlannerApp() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [source, setSource] = useState<Source>("free-text");
  const [title, setTitle] = useState("");
  const [scenario, setScenario] = useState("");
  const [epicKey, setEpicKey] = useState("");
  const [runId, setRunId] = useState<string>();
  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [notice, setNotice] = useState<string>();

  const { run } = useRunSubscription(runId);

  // When the planning job completes, copy its plan into editable local state.
  useEffect(() => {
    if (run?.status === "completed" && run.output?.plan) {
      setPlan(run.output.plan as TestPlan);
    }
  }, [run]);

  const canPlan =
    title.trim() !== "" &&
    (source === "free-text" ? scenario.trim() !== "" : epicKey.trim() !== "");
  const planning =
    run !== null && run.status !== "completed" && run.status !== "failed";

  async function handlePlan() {
    setPlan(null);
    setNotice(undefined);
    const job = await appsClient.planTests({
      title: title.trim(),
      source,
      scenario: scenario.trim() || undefined,
      epic_key: epicKey.trim() || undefined,
    });
    setRunId(job.run_id);
  }

  function updateTest(index: number, next: PlannedTest) {
    if (!plan) return;
    setPlan({
      ...plan,
      tests: plan.tests.map((t, i) => (i === index ? next : t)),
    });
  }

  function removeTest(index: number) {
    if (!plan) return;
    setPlan({ ...plan, tests: plan.tests.filter((_, i) => i !== index) });
  }

  async function savePlanDraft() {
    if (!plan) return;
    const md = planToMarkdown(plan);
    await artifactsClient.createDraft({
      name: `${slug(plan.title)}-plan.md`,
      type: "plan",
      language: "markdown",
      content: md,
      workspace: user?.workspace.id ?? "docsis-team",
      run_id: runId,
    });
    setNotice("Plan saved as a draft artifact.");
  }

  function sendToCodegen(test: PlannedTest) {
    setCodegenPrefill({
      name: test.name,
      description: `${plan?.title ?? ""} (${plan?.source ?? ""})`.trim(),
      preconditions: test.preconditions,
      steps: test.steps.map((s) => ({ instruction: s })),
    });
    navigate("/codegen");
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="text-lg font-semibold">Test planner</h1>
      <p className="mt-0.5 text-xs text-muted">
        Turn a scenario into a reviewed set of planned tests, then hand them to
        codegen.
      </p>

      <div className="mt-5 rounded-[10px] border border-border bg-surface p-4">
        <div className="flex gap-1.5">
          {(
            [
              ["free-text", "Free-text scenario"],
              ["jira-epic", "Jira epic"],
            ] as [Source, string][]
          ).map(([s, label]) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition",
                source === s
                  ? "bg-accent/15 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Plan title"
            required
            value={title}
            onChange={setTitle}
            placeholder="wan ipv4 regression pack"
          />
          {source === "free-text" ? (
            <TextField
              label="Scenario"
              required
              multiline
              rows={4}
              value={scenario}
              onChange={setScenario}
              placeholder="Cover WAN IPv4 behavior across reboots, lease renewals and provisioning modes…"
            />
          ) : (
            <TextField
              label="Epic key"
              required
              value={epicKey}
              onChange={setEpicKey}
              placeholder="BF-EPIC-12"
            />
          )}
        </div>

        <div className="mt-4">
          <Button variant="primary" disabled={!canPlan || planning} onClick={() => void handlePlan()}>
            <Play className="h-4 w-4" />
            {planning ? "Planning…" : "Plan tests"}
          </Button>
        </div>
      </div>

      {run && !plan && (
        <div className="mt-4">
          <JobProgress run={run} />
        </div>
      )}

      {plan && (
        <div className="mt-6">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-accent" />
            <span className="text-[13px] font-medium">
              {plan.tests.length} planned tests
            </span>
            <span className="font-mono text-[11px] text-faint">{plan.source}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => void savePlanDraft()}>
                <Save className="h-3.5 w-3.5" />
                Save plan as draft
              </Button>
            </div>
          </div>
          {notice && <p className="mt-2 text-[11.5px] text-muted">{notice}</p>}

          <div className="mt-3 flex flex-col gap-3">
            {plan.tests.map((test, i) => (
              <PlannedTestCard
                key={i}
                test={test}
                onChange={(next) => updateTest(i, next)}
                onRemove={() => removeTest(i)}
                onSend={() => sendToCodegen(test)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlannedTestCard({
  test,
  onChange,
  onRemove,
  onSend,
}: {
  test: PlannedTest;
  onChange: (next: PlannedTest) => void;
  onRemove: () => void;
  onSend: () => void;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface p-4">
      <div className="flex flex-col gap-3.5">
        <TextField
          label="Test name"
          value={test.name}
          onChange={(name) => onChange({ ...test, name })}
        />
        <TextField
          label="Preconditions"
          value={test.preconditions ?? ""}
          onChange={(preconditions) => onChange({ ...test, preconditions })}
        />
        <TextField
          label="Tags (comma-separated)"
          value={test.tags.join(", ")}
          onChange={(raw) =>
            onChange({
              ...test,
              tags: raw.split(",").map((t) => t.trim()).filter(Boolean),
            })
          }
        />
        <TextField
          label="Steps (one per line)"
          multiline
          rows={Math.max(3, test.steps.length + 1)}
          value={test.steps.join("\n")}
          onChange={(raw) =>
            onChange({
              ...test,
              steps: raw.split("\n").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={onSend}>
          <Send className="h-3.5 w-3.5" />
          Send to codegen
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
      </div>
    </div>
  );
}

function planToMarkdown(plan: TestPlan): string {
  const rows = plan.tests
    .map((t) => `| ${t.name} | ${t.tags.join(", ")} | ${t.steps.length} |`)
    .join("\n");
  return `# ${plan.title}\n\nSource: ${plan.source}\n\n| name | tags | steps |\n|---|---|---|\n${rows}\n`;
}

function slug(text: string): string {
  return (
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "plan"
  );
}
