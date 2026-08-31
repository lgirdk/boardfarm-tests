import { FieldRenderer } from "./FieldRenderer";
import type {
  ConfigRecord,
  EnumOption,
  FieldDescriptor,
  RefTarget,
} from "@/lib/schema/types";

export interface RecordFormProps {
  fields: FieldDescriptor[];
  record: ConfigRecord;
  errors?: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  resolveRefOptions?: (target: RefTarget) => EnumOption[];
}

/**
 * Renders an ordered list of fields for a single record. Pure layout over
 * FieldRenderer — no per-surface logic lives here.
 */
export function RecordForm({
  fields,
  record,
  errors,
  onChange,
  resolveRefOptions,
}: RecordFormProps) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          record={record}
          value={record[field.key]}
          error={errors?.[field.key]}
          onChange={onChange}
          resolveRefOptions={resolveRefOptions}
        />
      ))}
    </div>
  );
}
