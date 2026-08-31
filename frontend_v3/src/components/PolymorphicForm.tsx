import { SelectField } from "./SelectField";
import { RecordForm } from "./RecordForm";
import { activeFields, switchVariant } from "@/lib/schema/polymorphic";
import type {
  ConfigRecord,
  EnumOption,
  PolymorphicSchema,
  RefTarget,
} from "@/lib/schema/types";

export interface PolymorphicFormProps {
  schema: PolymorphicSchema;
  record: ConfigRecord;
  errors?: Record<string, string>;
  onChange: (next: ConfigRecord) => void;
  resolveRefOptions?: (target: RefTarget) => EnumOption[];
}

/**
 * Renders a discriminated-union record (e.g. an encoder switching on
 * `encoder_type`): a type selector, then the fields for the active variant.
 * Changing the type swaps the field set and prunes stale keys.
 */
export function PolymorphicForm({
  schema,
  record,
  errors,
  onChange,
  resolveRefOptions,
}: PolymorphicFormProps) {
  const disc = String(record[schema.discriminator] ?? "");

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Type"
        description={`Selects the variant (${schema.discriminator}).`}
        required
        error={errors?.[schema.discriminator]}
        value={disc}
        onChange={(value) => onChange(switchVariant(schema, record, value))}
        options={schema.variants.map((v) => ({ value: v.value, label: v.label }))}
      />

      <RecordForm
        fields={activeFields(schema, record)}
        record={record}
        errors={errors}
        onChange={(key, value) => onChange({ ...record, [key]: value })}
        resolveRefOptions={resolveRefOptions}
      />
    </div>
  );
}
