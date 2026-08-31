import { TextField } from "./TextField";
import { SelectField, type SelectOption } from "./SelectField";
import { SwitchField } from "./SwitchField";
import { ReorderableList } from "./ReorderableList";
import type {
  ConfigRecord,
  EnumOption,
  FieldDescriptor,
  RefTarget,
} from "@/lib/schema/types";

export interface FieldRendererProps {
  field: FieldDescriptor;
  /** The whole record (needed for visibleWhen). */
  record: ConfigRecord;
  value: unknown;
  error?: string;
  onChange: (key: string, value: unknown) => void;
  /** Supplies allowed values for `ref` fields (cross-file keys). */
  resolveRefOptions?: (target: RefTarget) => EnumOption[];
}

/**
 * Generic dispatch from a field descriptor to a concrete control. This is the
 * ONLY place that maps schema kinds → widgets, so a new surface never writes
 * bespoke field JSX.
 */
export function FieldRenderer({
  field,
  record,
  value,
  error,
  onChange,
  resolveRefOptions,
}: FieldRendererProps) {
  if (field.visibleWhen && !field.visibleWhen(record)) return null;

  const set = (v: unknown) => onChange(field.key, v);

  switch (field.kind) {
    case "string":
      return (
        <TextField
          label={field.label}
          description={field.description}
          required={field.required}
          error={error}
          placeholder={field.placeholder}
          readOnly={field.readOnly}
          multiline={field.multiline}
          value={asString(value)}
          onChange={set}
        />
      );

    case "int":
    case "float":
      return (
        <TextField
          label={field.label}
          description={field.description}
          required={field.required}
          error={error}
          inputMode="numeric"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(raw) => set(parseNumber(raw, field.kind))}
        />
      );

    case "bool":
      return (
        <SwitchField
          label={field.label}
          description={field.description}
          value={Boolean(value)}
          onChange={set}
        />
      );

    case "enum":
      return (
        <SelectField
          label={field.label}
          description={field.description}
          required={field.required}
          error={error}
          value={asString(value)}
          onChange={set}
          options={toSelectOptions(field.options)}
        />
      );

    case "ref": {
      const options = resolveRefOptions?.(field.refTarget) ?? [];
      return (
        <SelectField
          label={field.label}
          description={field.description}
          required={field.required}
          error={error}
          value={asString(value)}
          onChange={set}
          options={toSelectOptions(options)}
          placeholder="Select a reference…"
        />
      );
    }

    case "list":
      // Ordered lists (order is meaningful) get the reorderable control; plain
      // lists use a lightweight newline editor.
      if (field.ordered) {
        return (
          <ReorderableList
            label={field.label}
            description={field.description}
            error={error}
            value={asStringList(value)}
            onChange={set}
          />
        );
      }
      return (
        <TextField
          label={`${field.label} (one per line)`}
          description={field.description}
          required={field.required}
          error={error}
          value={asStringList(value).join("\n")}
          onChange={(raw) =>
            set(raw.split("\n").map((s) => s.trim()).filter(Boolean))
          }
        />
      );
  }
}

function asString(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function parseNumber(raw: string, kind: "int" | "float"): number | string {
  if (raw.trim() === "") return "";
  const n = kind === "int" ? parseInt(raw, 10) : parseFloat(raw);
  return Number.isNaN(n) ? raw : n;
}

function toSelectOptions(options: EnumOption[]): SelectOption[] {
  return options.map((o) => ({ value: o.value, label: o.label ?? o.value }));
}
