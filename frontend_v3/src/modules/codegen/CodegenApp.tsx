import { useEffect, useMemo, useState } from "react";
import { Download, Play, Rocket, Save } from "lucide-react";
import { Button } from "@/components/Button";
import { RecordForm } from "@/components/RecordForm";
import { TextField } from "@/components/TextField";
import { CodeView } from "@/components/CodeView";
import { CopyButton } from "@/components/CopyButton";
import { JobProgress } from "@/components/JobProgress";
import { appsClient } from "@/lib/apps";
import { artifactsClient } from "@/lib/artifacts";
import { environmentsClient } from "@/lib/environments";
import { useAuth } from "@/lib/auth";
import { useWorkbench } from "@/lib/workbench";
import { useRunSubscription } from "@/lib/runs/useRunSubscription";
import { consumeCodegenPrefill } from "@/lib/handoff";
import { describeRequirement, checkEnvironment } from "@/lib/requirement";
import type {
  Artifact,
  CodegenGenerateInput,
  EnvConfig,
  JiraTicket,
  Requirement,
  TestAsset,
} from "@/lib/contracts";
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
  ["jira", "From a Jira ticket"],
  ["structured", "Write steps"],
  ["free", "Describe it"],
];

/**
 * Codegen: three input modes feeding one generate job. Generation goes through
 * the AppsClient (returns a run id) and progress arrives via the run
 * subscription — never a synchronous spinner.
 */
export function CodegenApp() {
  // Planner handoff (typed contract, consumed once).
  const prefill = useMemo(() => consumeCodegenPrefill(), []);

  const [mode, setMode] = useState<InputMode>(prefill ? "free" : "jira");
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
  const { runTests } = useWorkbench();
  const [envs, setEnvs] = useState<EnvConfig[]>([]);
  const [savedNote, setSavedNote] = useState<string>();

  useEffect(() => {
    void environmentsClient.list().then(setEnvs);
  }, []);

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

  const requirement = useMemo(() => inferRequirement(payload), [payload]);
  const matchEnv = useMemo(
    () => envs.find((e) => checkEnvironment(e, requirement).ok) ?? null,
    [envs, requirement],
  );

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

  async function saveAndRun() {
    if (!generatedCode) return;
    const draft = await artifactsClient.createDraft({
      name: `test_${fileName}.py`,
      type: "test_code",
      language: "python",
      content: generatedCode,
      workspace: user?.workspace.id ?? "docsis-team",
      run_id: runId,
      source_ref: payload?.name ?? "codegen",
      env_modes: requirement?.modes ?? ["dual"],
      lan_clients: requirement?.lanClients || 1,
      capabilities: requirement?.capabilities ?? [],
    });
    runTests([genAsset(draft, requirement)]);
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-lg font-semibold">Generate a test</h1>
      <p className="mt-0.5 text-xs text-muted">
        A ticket, structured steps, or a sentence in — a runnable pytest script out. You see
        what it will need, and can send it straight to a run.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* INPUT */}
        <section>
          <div className="flex gap-1 rounded-[9px] border border-border bg-surface-raised p-0.5">
            {MODES.map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-[7px] py-1.5 text-[12px] transition",
                  mode === m
                    ? "bg-surface text-foreground shadow"
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
            <div className="flex h-[420px] flex-col items-center justify-center rounded-[10px] border border-border bg-surface/40 px-6 text-center">
              <p className="text-[13px] text-muted">The generated test will appear here.</p>
              <p className="mt-2 max-w-sm text-[11.5px] text-faint">
                It searches ~4,000 boardfarm API stubs and writes against the real use-case
                helpers, not invented ones.
              </p>
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
                    <Button size="sm" variant="primary" onClick={() => void saveAndRun()}>
                      <Rocket className="h-3.5 w-3.5" />
                      Save &amp; run it now
                    </Button>
                  </div>
                </div>
                <CodeView
                  code={generatedCode}
                  language="python"
                  className="rounded-none border-0"
                />
              </div>
              <div className="rounded-[10px] border border-border bg-surface/40 p-3.5">
                <div className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                  This test will need
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {describeRequirement(requirement).map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 text-[11.5px]">
                  {matchEnv ? (
                    <span className="text-ok">
                      ✓ <span className="font-mono">{matchEnv.name}</span> satisfies this
                    </span>
                  ) : (
                    <span className="text-warning">
                      no saved environment matches — you&apos;ll set one up in the composer
                    </span>
                  )}
                </div>
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

function inferRequirement(payload: CodegenGenerateInput | null): Requirement | null {
  if (!payload) return null;
  const text = [
    payload.name,
    payload.description ?? "",
    payload.preconditions ?? "",
    ...payload.steps.map((s) => `${s.instruction} ${s.expected_result ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
  const modes: string[] = [];
  if (text.includes("dual")) modes.push("dual");
  if (text.includes("ipv6")) modes.push("ipv6");
  if (/ds-?lite/.test(text)) modes.push("dslite");
  if (text.includes("ipv4")) modes.push("ipv4");
  if (modes.length === 0) modes.push("dual");
  const caps: string[] = [];
  if (/voice|sip|fxs|emta|\bcall\b/.test(text)) caps.push("voice");
  if (/tr-?069|acs|cwmp/.test(text)) caps.push("tr069");
  if (/5\s?ghz|wifi5|11ac/.test(text)) caps.push("wifi5");
  if (/2\.4\s?ghz|wifi24|bgn/.test(text)) caps.push("wifi24");
  if (/\bgui\b|browser|web ui|firewall rule/.test(text)) caps.push("gui");
  const m = text.match(/(\d+)\s*(?:lan|client)/);
  const lanClients = m
    ? Number(m[1])
    : /two clients|second client|between .*clients/.test(text)
      ? 2
      : 1;
  return {
    modes: [...new Set(modes)],
    lanClients,
    capabilities: [...new Set(caps)],
    conflict: false,
  };
}

function genAsset(a: Artifact, req: Requirement | null): TestAsset {
  return {
    id: a.id,
    name: a.name.replace(/\.py$/, ""),
    path: `boardfarm/drafts/${a.name}`,
    suite: "drafts",
    tags: req?.capabilities ?? [],
    env_modes: req?.modes ?? ["dual"],
    lan_clients: req?.lanClients || 1,
    capabilities: req?.capabilities ?? [],
    runtime: "~2m",
    description: "Generated draft — review before publishing",
    source: "git",
    updated_at: a.created_at,
  };
}
