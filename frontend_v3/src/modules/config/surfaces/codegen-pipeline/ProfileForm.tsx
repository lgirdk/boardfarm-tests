import { RecordForm } from "@/components/RecordForm";
import { validateRecord } from "@/lib/schema/toZod";
import { makeProfileMetaSchema, stageSettingsSchema } from "@/schemas/codegen.schema";
import { useRegistries } from "@/lib/registries";
import { useMemo } from "react";
import type { ConfigRecord } from "@/lib/schema/types";

export interface ProfileFormProps {
  profile: ConfigRecord;
  /** Stage names (from [stages.*]) — one settings sub-table is rendered per stage. */
  stageNames: string[];
  onChange: (next: ConfigRecord) => void;
}

/**
 * Editor for one `[profiles.<name>]`: top-level metadata plus one
 * `[profiles.<name>.<stage>]` settings sub-table per pipeline stage.
 *
 * The metadata schema (specifically the `prompt_variant` enum options) comes
 * from the live backend registries so the dropdown stays in sync with the
 * backend's CodegenPromptVariant enum.
 */
export function ProfileForm({ profile, stageNames, onChange }: ProfileFormProps) {
  const { registries } = useRegistries();
  const profileMetaSchema = useMemo(
    () => makeProfileMetaSchema(registries),
    [registries],
  );
  const metaErrors = validateRecord(profileMetaSchema.fields, profile);

  function setMeta(key: string, value: unknown) {
    onChange({ ...profile, [key]: value });
  }

  function setStageSetting(stage: string, key: string, value: unknown) {
    const current = (profile[stage] as ConfigRecord) ?? {};
    onChange({ ...profile, [stage]: { ...current, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-6">
      <RecordForm
        fields={profileMetaSchema.fields}
        record={profile}
        errors={metaErrors}
        onChange={setMeta}
      />

      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Per-stage settings
        </h3>
        {stageNames.map((stage) => {
          const settings = (profile[stage] as ConfigRecord) ?? {};
          const errors = validateRecord(stageSettingsSchema.fields, settings);
          return (
            <div
              key={stage}
              className="rounded-md border border-border bg-surface-raised/40 p-4"
            >
              <div className="mb-3 font-mono text-sm text-foreground">{stage}</div>
              <div className="grid grid-cols-2 gap-4">
                <RecordForm
                  fields={stageSettingsSchema.fields}
                  record={settings}
                  errors={errors}
                  onChange={(key, value) => setStageSetting(stage, key, value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
