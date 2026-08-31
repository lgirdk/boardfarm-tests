import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Code2,
  Copy,
  FileJson2,
  GitCompare,
  Layers,
  ListFilter,
  ListTree,
  Lock,
  Play,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { buildEnvContent, environmentsClient } from "@/lib/environments";
import { fmtAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Button";
import { SlideOver } from "@/components/SlideOver";
import { TextField } from "@/components/TextField";
import { SelectField } from "@/components/SelectField";
import { SwitchField } from "@/components/SwitchField";
import type { EnvConfig, EnvProvMode, EnvVisibility } from "@/lib/contracts";
import {
  descriptorFor,
  bootFileFor,
  bootFileMtaFor,
  type EnvField,
} from "@/lib/environments/descriptor";

const BOARD_MODELS = ["CH7465LG", "F3896LG", "TG2492LG", "F5685LGE"];

function deriveTags(e: { prov_mode: EnvProvMode; wifi: boolean; voice: boolean }): string[] {
  return [e.prov_mode, ...(e.wifi ? ["wifi"] : []), ...(e.voice ? ["voice"] : [])];
}

/** Recompute derived fields (tags + JSON) after any change. */
function recompute(e: EnvConfig): EnvConfig {
  return { ...e, env_tags: deriveTags(e), content: buildEnvContent(e) };
}

function boardDefault(model: string): EnvConfig {
  return recompute({
    id: "",
    name: "",
    board_model: model,
    sku: "UPC",
    prov_mode: "ipv4",
    wifi: false,
    voice: false,
    lan: 1,
    tr069: false,
    wifi_bands: [],
    firmware: null,
    reset: false,
    visibility: "private",
    owner: "you",
    updated_at: Date.now(),
    env_tags: [],
    content: "",
  });
}

function blankEnv(): EnvConfig {
  return boardDefault("CH7465LG");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Parse an English description into environment field changes. */
function applyAi(text: string): Partial<EnvConfig> {
  const t = text.toLowerCase();
  const patch: Partial<EnvConfig> = {};
  if (t.includes("ipv6")) patch.prov_mode = "ipv6";
  else if (t.includes("dslite") || t.includes("ds-lite")) patch.prov_mode = "dslite";
  else if (t.includes("dual")) patch.prov_mode = "dual";
  else if (t.includes("ipv4")) patch.prov_mode = "ipv4";
  patch.voice = /voice|emta|sip|pjsip/.test(t);
  patch.tr069 = /tr-?069|acs|cwmp/.test(t);
  const bands: string[] = [];
  if (/2\.4|2g|bgn/.test(t)) bands.push("2.4");
  if (/5\s?g|wifi5|11ac/.test(t)) bands.push("5");
  if (/6\s?g|wifi6|11ax/.test(t)) bands.push("6");
  patch.wifi_bands = bands;
  patch.wifi = bands.length > 0;
  const m = t.match(/(\d+)\s*(?:lan|client)/);
  if (m) patch.lan = Number(m[1]);
  if (/reset|wipe|factory/.test(t)) patch.reset = true;
  return patch;
}

/* descriptor field <-> EnvConfig mapping */
function getField(e: EnvConfig, key: string): unknown {
  switch (key) {
    case "prov_mode":
      return e.prov_mode;
    case "sku":
      return e.sku;
    case "country":
      return "PL";
    case "lan":
      return e.lan;
    case "wifi_bands":
      return e.wifi_bands;
    case "firmware":
      return e.firmware ?? "";
    case "flash_strategy":
      return "all";
    case "reset":
      return e.reset ?? false;
    case "voice":
      return e.voice;
    case "tr069":
      return e.tr069;
    case "boot_file":
      return bootFileFor(e);
    case "boot_file_mta":
      return bootFileMtaFor(e);
    default:
      return "";
  }
}
function setField(key: string, value: unknown): Partial<EnvConfig> {
  switch (key) {
    case "prov_mode":
      return { prov_mode: value as EnvProvMode };
    case "sku":
      return { sku: value as string };
    case "lan":
      return { lan: Number(value) };
    case "wifi_bands": {
      const b = value as string[];
      return { wifi_bands: b, wifi: b.length > 0 };
    }
    case "firmware":
      return { firmware: (value as string) || null };
    case "reset":
      return { reset: Boolean(value) };
    case "voice":
      return { voice: Boolean(value) };
    case "tr069":
      return { tr069: Boolean(value) };
    default:
      return {};
  }
}
function dispField(field: EnvField, v: unknown): string {
  if (field.type === "bool") return v ? "on" : "off";
  if (field.type === "list") {
    const b = v as string[];
    return b.length ? b.map((x) => `${x}G`).join(" + ") : "none";
  }
  if (field.type === "count") return String(v);
  if (v === "" || v == null) return "(none)";
  return String(v);
}

/**
 * Environments — a browsable catalog of reusable provisioning descriptors,
 * plus a dual Form/JSON editor. Envs are shared assets (published) or personal
 * (private); they're also selectable inline during a run.
 */
export function EnvironmentsApp() {
  const navigate = useNavigate();
  const [envs, setEnvs] = useState<EnvConfig[] | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [vis, setVis] = useState<EnvVisibility | null>(null);
  const [draft, setDraft] = useState<EnvConfig | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useState<EnvConfig | null>(null);
  const [path, setPath] = useState<"choose" | "edit">("edit");
  const [tab, setTab] = useState<"changes" | "all" | "json">("changes");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    let active = true;
    void environmentsClient.list().then((e) => active && setEnvs(e));
    return () => {
      active = false;
    };
  }, []);

  const models = useMemo(
    () => [...new Set(envs?.map((e) => e.board_model) ?? [])].sort(),
    [envs],
  );
  const visible = useMemo(
    () =>
      (envs ?? []).filter(
        (e) => (!model || e.board_model === model) && (!vis || e.visibility === vis),
      ),
    [envs, model, vis],
  );
  const descriptor = useMemo(
    () => (draft ? descriptorFor(draft.board_model) : []),
    [draft?.board_model], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const changed = useMemo(() => {
    if (!draft || !base) return [] as EnvField[];
    return descriptor
      .flatMap((g) => g.fields)
      .filter(
        (f) =>
          f.core && dispField(f, getField(draft, f.key)) !== dispField(f, getField(base, f.key)),
      );
  }, [draft, base, descriptor]);

  function openNew() {
    setDraft(blankEnv());
    setBase(null);
    setPath("choose");
    setTab("changes");
    setAiText("");
    setJsonError(null);
  }

  function openEdit(e: EnvConfig) {
    setDraft(structuredClone(e));
    setBase(structuredClone(e));
    setPath("edit");
    setTab("changes");
    setJsonError(null);
  }

  function startDerive() {
    const b = boardDefault(draft?.board_model ?? "CH7465LG");
    setBase(b);
    setDraft(recompute({ ...b, prov_mode: "dual", lan: 2, voice: true, tr069: true }));
    setPath("edit");
    setTab("changes");
  }

  function startFromBase(e: EnvConfig) {
    setBase(structuredClone(e));
    setDraft(
      recompute({
        ...structuredClone(e),
        id: "",
        name: `${e.name} (copy)`,
        visibility: "private",
        owner: "you",
        updated_at: Date.now(),
      }),
    );
    setPath("edit");
    setTab("changes");
  }

  function startAi() {
    const b = boardDefault(draft?.board_model ?? "CH7465LG");
    setBase(b);
    setDraft(recompute({ ...b, ...applyAi(aiText) }));
    setPath("edit");
    setTab("all");
  }

  function patchForm(patch: Partial<EnvConfig>) {
    setDraft((d) => (d ? recompute({ ...d, ...patch }) : d));
  }

  function patchJson(content: string) {
    setDraft((d) => (d ? { ...d, content } : d));
    try {
      JSON.parse(content);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  async function commit(visibility: EnvVisibility) {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);
    const toSave = recompute({
      ...draft,
      name,
      visibility,
      id: draft.id || `env-${slug(name)}`,
    });
    const saved = await environmentsClient.save(toSave);
    setEnvs((prev) => [saved, ...(prev ?? []).filter((e) => e.id !== saved.id)]);
    setSaving(false);
    setDraft(null);
  }

  function useInRun(e: EnvConfig) {
    navigate(`/runs/new?env=${encodeURIComponent(e.id)}`);
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-highlight" />
          <h1 className="text-lg font-semibold tracking-tight">Environments</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          Reusable provisioning descriptors (environment_def). Publish to share with
          the team, or keep a private one. Also selectable inline when you start a run.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <FilterChip label="all boards" active={model === null} onClick={() => setModel(null)} />
          {models.map((m) => (
            <FilterChip
              key={m}
              label={m}
              active={model === m}
              onClick={() => setModel(model === m ? null : m)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <FilterChip
            label="published"
            active={vis === "published"}
            onClick={() => setVis(vis === "published" ? null : "published")}
          />
          <FilterChip
            label="private"
            active={vis === "private"}
            onClick={() => setVis(vis === "private" ? null : "private")}
          />
          <div className="ml-auto">
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" />
              New environment
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {envs === null && <p className="text-sm text-faint">Loading environments…</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((e) => (
            <div
              key={e.id}
              className="flex flex-col rounded-[12px] border border-border bg-surface/40 p-4 transition hover:border-border-strong"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-foreground">{e.name}</span>
                <VisibilityChip visibility={e.visibility} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Meta k="board" v={e.board_model} />
                <Meta k="sku" v={e.sku} />
                <Meta k="mode" v={e.prov_mode} />
                {e.wifi && <Tag v="wifi" />}
                {e.voice && <Tag v="voice" />}
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                <span className="text-[11px] text-faint">
                  {e.owner} · {fmtAgo(e.updated_at)}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                    <Code2 className="h-3.5 w-3.5" />
                    View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => useInRun(e)}>
                    <Play className="h-3.5 w-3.5" />
                    Use in run
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* editor */}
      <SlideOver
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit environment" : "New environment"}
        description={
          path === "choose"
            ? "Pick how to start — you'll review every change as a diff."
            : "Diff-first: Changes shows only what differs from the base."
        }
        widthClass="w-[620px]"
        footer={
          draft && path === "edit" ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-faint">
                {changed.length
                  ? `${changed.length} change${changed.length === 1 ? "" : "s"} from base`
                  : "no changes from base"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving || !draft.name.trim() || jsonError !== null}
                  onClick={() => void commit("private")}
                >
                  <Lock className="h-3.5 w-3.5" /> Save privately
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !draft.name.trim() || jsonError !== null}
                  onClick={() => void commit("published")}
                >
                  <Users className="h-3.5 w-3.5" /> Publish to team
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {draft && path === "choose" && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted">How do you want to start?</p>
            <PathCard
              icon={<GitCompare className="h-4 w-4 text-highlight" />}
              title="Derive from a requirement"
              desc="Start from what a set of tests needs — dual-stack, voice, 2 LAN — then adjust."
              onClick={startDerive}
            />
            <div className="rounded-[11px] border border-border bg-surface/40 p-3.5">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-accent" />
                <span className="text-[13px] font-medium">Start from a base</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-faint">
                Clone an existing environment and change only what differs.
              </p>
              <select
                defaultValue=""
                onChange={(e) => {
                  const env = envs?.find((x) => x.id === e.target.value);
                  if (env) startFromBase(env);
                }}
                className="mt-2 w-full rounded-[8px] border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-accent/60"
              >
                <option value="">Choose an environment…</option>
                {(envs ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-[11px] border border-border bg-surface/40 p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-highlight" />
                <span className="text-[13px] font-medium">Describe in English</span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-faint">
                Say what you need; we set the fields, you review the diff.
              </p>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={2}
                placeholder="dual-stack with voice and TR-069, 2 LAN clients, 5GHz wifi"
                className="mt-2 w-full rounded-[8px] border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] text-foreground outline-none focus:border-accent/60"
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={!aiText.trim()}
                onClick={startAi}
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate fields
              </Button>
            </div>
          </div>
        )}

        {draft && path === "edit" && (
          <div className="space-y-4">
            <TextField
              label="Name"
              required
              value={draft.name}
              onChange={(v) => patchForm({ name: v })}
              placeholder="CH7465LG · UPC dual + voice"
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Board model"
                value={draft.board_model}
                onChange={(v) => patchForm({ board_model: v })}
                options={BOARD_MODELS.map((m) => ({ value: m, label: m }))}
              />
              <div className="flex items-end pb-1">
                <VisibilityChip visibility={draft.visibility} />
              </div>
            </div>

            <div className="flex gap-1 rounded-[9px] border border-border bg-surface-raised p-0.5">
              <ModeButton active={tab === "changes"} onClick={() => setTab("changes")}>
                <GitCompare className="h-3.5 w-3.5" />
                Changes{changed.length ? ` · ${changed.length}` : ""}
              </ModeButton>
              <ModeButton active={tab === "all"} onClick={() => setTab("all")}>
                <ListTree className="h-3.5 w-3.5" />
                All fields
              </ModeButton>
              <ModeButton active={tab === "json"} onClick={() => setTab("json")}>
                <FileJson2 className="h-3.5 w-3.5" />
                JSON
              </ModeButton>
            </div>

            {tab === "changes" &&
              (changed.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-border px-4 py-8 text-center text-[12px] text-faint">
                  No changes from the base yet. Edit in{" "}
                  <button className="text-accent" onClick={() => setTab("all")}>
                    All fields
                  </button>{" "}
                  — anything you change shows up here.
                </div>
              ) : (
                <div className="space-y-3">
                  {changed.map((f) => (
                    <div
                      key={f.key}
                      className="rounded-[10px] border border-accent/30 bg-accent/5 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-medium">{f.label}</span>
                        <span className="text-[11px] text-faint">
                          <span className="line-through">
                            {dispField(f, getField(base as EnvConfig, f.key))}
                          </span>{" "}
                          <ChevronRight className="inline h-3 w-3" />{" "}
                          <span className="text-highlight">
                            {dispField(f, getField(draft, f.key))}
                          </span>
                        </span>
                      </div>
                      <FieldControl field={f} env={draft} onPatch={patchForm} />
                    </div>
                  ))}
                </div>
              ))}

            {tab === "all" && (
              <div className="space-y-4">
                {descriptor.map((group) => (
                  <div key={group.name}>
                    <div className="mb-2 text-[10.5px] uppercase tracking-[0.05em] text-faint">
                      {group.name}
                    </div>
                    <div className="space-y-3">
                      {group.fields.map((f) => (
                        <FieldControl key={f.key} field={f} env={draft} onPatch={patchForm} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "json" && (
              <div>
                <textarea
                  value={draft.content}
                  onChange={(e) => patchJson(e.target.value)}
                  spellCheck={false}
                  rows={22}
                  className="w-full rounded-[9px] border border-border bg-surface-inset px-3 py-2 font-mono text-[11.5px] leading-relaxed text-foreground outline-none focus:border-accent/60"
                />
                {jsonError ? (
                  <p className="mt-1.5 text-[11px] text-danger">✗ {jsonError}</p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-ok">✓ valid JSON</p>
                )}
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function PathCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[11px] border border-border bg-surface/40 p-3.5 text-left transition hover:border-accent/50 hover:bg-accent/5"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[13px] font-medium">{title}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-faint">{desc}</p>
    </button>
  );
}

function FieldControl({
  field,
  env,
  onPatch,
}: {
  field: EnvField;
  env: EnvConfig;
  onPatch: (p: Partial<EnvConfig>) => void;
}) {
  const v = getField(env, field.key);

  if (field.type === "blob")
    return <BlobRow label={field.label} hint={field.hint} content={String(v)} />;

  if (!field.core)
    return (
      <div className="flex items-center justify-between rounded-[8px] border border-border bg-surface-inset px-3 py-2">
        <span className="text-[12px] text-muted">{field.label}</span>
        <span className="font-mono text-[11.5px] text-faint">{String(v)}</span>
      </div>
    );

  if (field.type === "enum")
    return (
      <SelectField
        label={field.label}
        description={field.hint}
        value={String(v)}
        onChange={(x) => onPatch(setField(field.key, x))}
        options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
      />
    );

  if (field.type === "bool")
    return (
      <SwitchField
        label={field.label}
        value={Boolean(v)}
        onChange={(x) => onPatch(setField(field.key, x))}
      />
    );

  if (field.type === "count")
    return (
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-faint">
          {field.label}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={Number(v)}
            onChange={(e) => onPatch(setField(field.key, e.target.value))}
            className="w-20 rounded-[7px] border border-border bg-surface-raised px-2 py-1 text-[12px] text-foreground outline-none focus:border-accent/60"
          />
          {field.unit && <span className="text-[11px] text-faint">{field.unit}</span>}
        </div>
      </div>
    );

  if (field.type === "list")
    return (
      <BandsField
        label={field.label}
        options={field.options ?? []}
        value={v as string[]}
        onChange={(b) => onPatch(setField(field.key, b))}
      />
    );

  // text | path
  return (
    <TextField
      label={field.label}
      value={String(v ?? "")}
      onChange={(x) => onPatch(setField(field.key, x))}
      placeholder={field.hint}
    />
  );
}

function BandsField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (bands: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-faint">{label}</div>
      <div className="flex items-center gap-1.5">
        {options.map((b) => {
          const on = value.includes(b);
          return (
            <button
              key={b}
              onClick={() => onChange(on ? value.filter((x) => x !== b) : [...value, b])}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] transition",
                on
                  ? "border-highlight/50 bg-highlight/10 text-highlight"
                  : "border-border text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              {b}GHz
            </button>
          );
        })}
        {value.length === 0 && <span className="ml-1 text-[11px] text-faint">radios off</span>}
      </div>
    </div>
  );
}

function BlobRow({
  label,
  hint,
  content,
}: {
  label: string;
  hint?: string;
  content: string;
}) {
  return (
    <details className="rounded-[9px] border border-border bg-surface-inset">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[12px] text-foreground">
        <Code2 className="h-3.5 w-3.5 text-faint" />
        <span className="font-mono">{label}</span>
        {hint && <span className="text-[10.5px] text-faint">{hint}</span>}
      </summary>
      <pre className="max-h-48 overflow-auto border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
        {content}
      </pre>
    </details>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[10.5px] text-muted">
      <span className="text-faint">{k}:</span> <span className="font-mono">{v}</span>
    </span>
  );
}

function Tag({ v }: { v: string }) {
  return (
    <span className="rounded-full border border-highlight/30 bg-highlight/10 px-1.5 py-0.5 text-[10px] text-highlight">
      {v}
    </span>
  );
}

function VisibilityChip({ visibility }: { visibility: EnvVisibility }) {
  const published = visibility === "published";
  return (
    <span
      className={cn(
        "ml-auto flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]",
        published
          ? "border-ok/30 bg-ok/10 text-ok"
          : "border-border bg-surface-raised text-faint",
      )}
    >
      {published ? <Users className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
      {published ? "team" : "private"}
    </span>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-3 py-1 text-[11.5px] transition",
        active
          ? "border-accent/60 bg-accent/15 text-foreground"
          : "border-border text-muted hover:border-border-strong hover:text-foreground",
      )}
    >
      {label === "all boards" && <ListFilter className="h-3 w-3" />}
      {label}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] py-1.5 text-[12px] transition",
        active ? "bg-accent/15 text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
