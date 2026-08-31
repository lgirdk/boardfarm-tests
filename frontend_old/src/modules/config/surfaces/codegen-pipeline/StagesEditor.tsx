import { RecordForm } from "@/components/RecordForm";
import { stageItemSchema } from "@/schemas/codegen.schema";
import type { RefResolver } from "@/lib/schema/crossRefs";
import { validateStage } from "./codegenValidation";
import type { ConfigRecord, EnumOption, RefTarget } from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;

export interface StagesEditorProps {
  stages: NamedMap;
  /** Keys of app.toml [llm.*] — options for the `llm` reference. */
  llmKeys: string[];
  /** Keys of [profiles.*] — options for the `profile` reference. */
  profileKeys: string[];
  /** Profiles map, to check each referenced profile has this stage's sub-table. */
  profiles: NamedMap;
  onChange: (next: NamedMap) => void;
}

/**
 * Edits the fixed `[stages.*]` set (reasoning/search/generation — derived from
 * the data, not hardcoded). Each stage picks an LLM and a profile by reference,
 * with cross-file validation surfaced inline before save.
 */
export function StagesEditor({
  stages,
  llmKeys,
  profileKeys,
  profiles,
  onChange,
}: StagesEditorProps) {
  const resolver: RefResolver = {
    keysFor: (target) =>
      target === "app.llm"
        ? llmKeys
        : target === "codegen.profiles"
          ? profileKeys
          : [],
  };

  const resolveRefOptions = (target: RefTarget): EnumOption[] =>
    resolver.keysFor(target).map((value) => ({ value }));

  function setStageField(stage: string, key: string, value: unknown) {
    const current = stages[stage] ?? {};
    onChange({ ...stages, [stage]: { ...current, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.keys(stages).map((stage) => {
        const record = stages[stage] ?? {};
        const errors = validateStage(stage, record, resolver, profiles);
        return (
          <div
            key={stage}
            className="rounded-md border border-border bg-surface-raised/40 p-4"
          >
            <div className="mb-3 font-mono text-sm text-foreground">{stage}</div>
            <div className="grid grid-cols-2 gap-4">
              <RecordForm
                fields={stageItemSchema.fields}
                record={record}
                errors={errors}
                onChange={(key, value) => setStageField(stage, key, value)}
                resolveRefOptions={resolveRefOptions}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
