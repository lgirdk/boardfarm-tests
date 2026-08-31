import { useMemo, useState } from "react";
import { NamedCollection } from "@/components/NamedCollection";
import { RecordForm } from "@/components/RecordForm";
import { PolymorphicForm } from "@/components/PolymorphicForm";
import { validateRecord } from "@/lib/schema/toZod";
import { validatePolymorphic } from "@/lib/schema/polymorphic";
import {
  addEntry,
  removeEntry,
  renameEntry,
  uniqueName,
  validateKey,
} from "@/lib/namedMap";
import type {
  ConfigRecord,
  EnumOption,
  ItemSchema,
  RefTarget,
} from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;

export interface NamedCollectionEditorProps {
  value: NamedMap;
  itemSchema: ItemSchema;
  keyLabel: string;
  newRecord: () => ConfigRecord;
  onChange: (next: NamedMap) => void;
  resolveRefOptions?: (target: RefTarget) => EnumOption[];
  /** Bounded collections disable structural edits (default open: all true). */
  canAdd?: boolean;
  canRename?: boolean;
  canRemove?: boolean;
  /**
   * Extra, cross-field validation merged on top of the per-field schema checks
   * (e.g. "at least one selector axis must be non-empty"). Keyed by field key.
   */
  validateExtra?: (record: ConfigRecord) => Record<string, string>;
}

/**
 * Edits a dynamic `[table.<name>]` collection: master list (add/remove/rename)
 * on the left, schema-driven RecordForm on the right with inline validation.
 * Generic over the item schema, so it serves LLMs / encoders / profiles alike.
 */
export function NamedCollectionEditor({
  value,
  itemSchema,
  keyLabel,
  newRecord,
  onChange,
  resolveRefOptions,
  canAdd = true,
  canRename = true,
  canRemove = true,
  validateExtra,
}: NamedCollectionEditorProps) {
  const names = useMemo(() => Object.keys(value), [value]);
  const [selected, setSelected] = useState<string | null>(names[0] ?? null);

  const selectedRecord = selected ? value[selected] : undefined;
  const errors = selectedRecord
    ? {
        ...(itemSchema.kind === "polymorphic"
          ? validatePolymorphic(itemSchema, selectedRecord)
          : validateRecord(itemSchema.fields, selectedRecord)),
        ...(validateExtra?.(selectedRecord) ?? {}),
      }
    : {};

  function handleAdd() {
    const name = uniqueName(value, "new_entry");
    onChange(addEntry(value, name, newRecord()));
    setSelected(name);
  }

  function handleRemove(name: string) {
    const next = removeEntry(value, name);
    onChange(next);
    if (selected === name) {
      const remaining = Object.keys(next);
      setSelected(remaining[0] ?? null);
    }
  }

  function handleRename(oldName: string, newName: string) {
    onChange(renameEntry(value, oldName, newName));
    if (selected === oldName) setSelected(newName);
  }

  function handleFieldChange(key: string, fieldValue: unknown) {
    if (!selected) return;
    const current = value[selected] ?? {};
    onChange({ ...value, [selected]: { ...current, [key]: fieldValue } });
  }

  return (
    <NamedCollection
      names={names}
      selected={selected}
      onSelect={setSelected}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onRename={handleRename}
      validateName={(name, current) => validateKey(value, name, current)}
      addLabel={`Add ${keyLabel}`}
      canAdd={canAdd}
      canRename={canRename}
      canRemove={canRemove}
      renderDetail={(name) => {
        const record = value[name] ?? {};
        if (itemSchema.kind === "polymorphic") {
          return (
            <PolymorphicForm
              schema={itemSchema}
              record={record}
              errors={errors}
              onChange={(next) => onChange({ ...value, [name]: next })}
              resolveRefOptions={resolveRefOptions}
            />
          );
        }
        return (
          <RecordForm
            fields={itemSchema.fields}
            record={record}
            errors={errors}
            onChange={handleFieldChange}
            resolveRefOptions={resolveRefOptions}
          />
        );
      }}
    />
  );
}
