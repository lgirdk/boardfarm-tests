import { useMemo, useState } from "react";
import { Download, Play, Save } from "lucide-react";
import { Button } from "@/components/Button";
import { RecordForm } from "@/components/RecordForm";
import { TextField } from "@/components/TextField";
import { CodeView } from "@/components/CodeView";
import { CopyButton } from "@/components/CopyButton";
import { JobProgress } from "@/components/JobProgress";
import { appsClient } from "@/lib/apps";
import { artifactsClient } from "@/lib/artifacts";
import { useAuth } from "@/lib/auth";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import { consumeCodegenPrefill } from "@/lib/handoff";
import type { CodegenGenerateInput, JiraTicket } from "@/lib/contracts";
import type { ConfigRecord } from "@/lib/schema/types";
import { cn } from "@/lib/cn";
import { JiraTicketPicker } from "./JiraTicketPicker";
import { StepsEditor } from "./StepsEditor";
import {
  buildPayload,
  newStep,
  specMetaSchema,
  validateSpec,
} from "./codegenInput";

type InputMode = "structured" | "jira" | "free";

const MODES: [InputMode, string][] = [
  ["structured", "Structured steps"],
  ["jira", "Jira ticket"],
  ["free", "Free text"],
];

/**
 * Codegen: three input modes feeding one generate job. Generation goes through
 * the AppsClient (returns a run id) and progress arrives via the run
 * subscription — never a synchronous spinner.
 */
export function CodegenApp() {
  // Planner handoff (typed contract, consumed once).
  const prefill = useMemo(() => consumeCodegenPrefill(), []);

  const [mode, setMode] = useState<InputMode>("structured");
  const [meta, setMeta] = useState<ConfigRecord>({
    name: prefill?.name ?? "",
    description: prefill?.description ?? "",
    preconditions: prefill?.preconditions ?? "",
  });
  const [steps, setSteps] = useState<ConfigRecord[]>(
    prefill?.steps.length
      ? prefill.steps.map((s) => ({
          instruction: s.instruction,
          additional_info: s.additional_info ?? "",
          expected_result: s.expected_result ?? "",
        }))
      : [newStep()],
  );

  // Jira mode state.
  const [ticket, setTicket] = useState<JiraTicket | null>(null);

  // Free-text mode state.
  const [freeName, setFreeName] = useState("");
  const [freeText, setFreeText] = useState("");

  const [runId, setRunId] = useState<string>();
  const { run } = useRunSubscription(runId);
  const { user } = useAuth();
  const [savedNote, setSavedNote] = useState<string>();

  const validation = useMemo(() => validateSpec(meta, steps), [meta, steps]);
  const generating =
    run !== null && run.status !== "completed" && run.status !== "failed";

  const payload: CodegenGenerateInput | null = useMemo(() => {
    if (mode === "structured") {
      return validation.canRun ? buildPayload(meta, steps) : null;
    }
    if (mode === "jira") {
      if (!ticket) return null;
      return {
        name: ticket.summary,
        description: ticket.description ?? null,
        preconditions: ticket.preconditions ?? null,
        steps: ticket.steps.map((s, i) => ({
          step_num: i + 1,
          instruction: s.instruction,
          expected_result: s.expected_result ?? null,
        })),
      };
    }
    if (!freeName.trim() || !freeText.trim()) return null;
    return {
      name: freeName.trim(),
      description: null,
      preconditions: null,
      steps: [{ step_num: 1, instruction: freeText.trim() }],
    };
  }, [mode, validation.canRun, meta, steps, ticket, freeName, freeText]);

  async function handleGenerate() {
    if (!payload || generating) return;
    setSavedNote(undefined);
    const job = await appsClient.generateCode(payload);
    setRunId(job.run_id);
  }

  const generatedCode =
    run?.status === "completed" && typeof run.output?.generated_code === "string"
      ? run.output.generated_code
      : null;

  const fileName =
    (payload?.name ?? "generated")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "generated";

  async function saveDraft() {
    if (!generatedCode) return;
    await artifactsClient.createDraft({
      name: `test_${fileName}.py`,
      type: "test_code",
      language: "python",
      content: generatedCode,
      workspace: user?.workspace.id ?? "docsis-team",
      run_id: runId,
    });
    setSavedNote("Saved as a draft artifact.");
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="text-lg font-semibold">Codegen</h1>
      <p className="mt-0.5 text-xs text-muted">
        Turn a test spec into a runnable pytest script. Pipeline behavior is set
        in Configuration.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* INPUT */}
        <section>
          <div className="flex gap-1.5">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs transition",
                  mode === m
                    ? "bg-accent/15 text-foreground"
                    : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-[10px] border border-border bg-surface p-4">
            {mode === "structured" && (
              <div className="flex flex-col gap-4">
                <RecordForm
                  fields={specMetaSchema.fields}
                  record={meta}
                  errors={validation.metaErrors}
                  onChange={(key, value) => setMeta({ ...meta, [key]: value })}
                />
                <StepsEditor
                  steps={steps}
                  errors={validation.stepErrors}
                  onChange={setSteps}
                />
              </div>
            )}

            {mode === "jira" && (
              <JiraTicketPicker onSelect={(t) => setTicket(t)} />
            )}

            {mode === "free" && (
              <div className="flex flex-col gap-4">
                <TextField
                  label="Test name"
                  required
                  value={freeName}
                  onChange={setFreeName}
                  placeholder="verify_wan_ipv4_connectivity"
                />
                <TextField
                  label="Specification"
                  required
                  multiline
                  rows={7}
                  value={freeText}
                  onChange={setFreeText}
                  placeholder="Reboot the CPE, wait for DOCSIS online, then verify the WAN interface holds an IPv4 lease…"
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="primary"
              disabled={!payload || generating}
              onClick={() => void handleGenerate()}
            >
              <Play className="h-4 w-4" />
              {generating ? "Generating…" : "Generate"}
            </Button>
            {mode === "structured" && validation.formError && (
              <span className="text-xs text-danger">{validation.formError}</span>
            )}
          </div>
        </section>

        {/* RESULT */}
        <section className="flex flex-col gap-3">
          {!run && (
            <div className="flex min-h-[120px] items-center justify-center rounded-[10px] border border-dashed border-border px-6 text-center text-xs text-faint">
              Fill in the spec and press Generate — progress and the result show
              here.
            </div>
          )}

          {run && <JobProgress run={run} />}

          {generatedCode && (
            <>
              <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
                <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
                  <span className="font-mono text-[11.5px] text-muted">
                    test_{fileName}.py
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <CopyButton text={generatedCode} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => download(`test_${fileName}.py`, generatedCode)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void saveDraft()}>
                      <Save className="h-3.5 w-3.5" />
                      Save as draft
                    </Button>
                  </div>
                </div>
                <CodeView
                  code={generatedCode}
                  language="python"
                  className="rounded-none border-0"
                />
              </div>
              {savedNote && <p className="text-[11.5px] text-muted">{savedNote}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/x-python" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
