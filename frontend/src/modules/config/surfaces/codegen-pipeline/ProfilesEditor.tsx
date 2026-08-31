import { useState } from "react";
import { NamedCollection } from "@/components/NamedCollection";
import {
  addEntry,
  removeEntry,
  renameEntry,
  uniqueName,
  validateKey,
} from "@/lib/namedMap";
import { newProfileRecord } from "@/schemas/codegen.schema";
import { useRegistries } from "@/lib/registries";
import { ProfileForm } from "./ProfileForm";
import type { ConfigRecord } from "@/lib/schema/types";

type NamedMap = Record<string, ConfigRecord>;

export interface ProfilesEditorProps {
  profiles: NamedMap;
  stageNames: string[];
  onChange: (next: NamedMap) => void;
}

/**
 * Open collection of `[profiles.<name>]`. Unlike LLMs, profiles are pure config
 * (no backend registration), so add/rename/remove are allowed. New profiles get
 * a settings sub-table per stage so they're valid to reference immediately.
 *
 * Default `prompt_variant` for new profiles is sourced from the live backend
 * registries (first known variant), so the UI stays in sync if the backend
 * adds or removes a variant.
 */
export function ProfilesEditor({
  profiles,
  stageNames,
  onChange,
}: ProfilesEditorProps) {
  const { registries } = useRegistries();
  const names = Object.keys(profiles);
  const [selected, setSelected] = useState<string | null>(names[0] ?? null);

  function handleAdd() {
    const name = uniqueName(profiles, "new_profile");
    onChange(addEntry(profiles, name, newProfileRecord(stageNames, registries)));
    setSelected(name);
  }

  function handleRemove(name: string) {
    const next = removeEntry(profiles, name);
    onChange(next);
    if (selected === name) setSelected(Object.keys(next)[0] ?? null);
  }

  function handleRename(oldName: string, newName: string) {
    onChange(renameEntry(profiles, oldName, newName));
    if (selected === oldName) setSelected(newName);
  }

  return (
    <NamedCollection
      names={names}
      selected={selected}
      onSelect={setSelected}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onRename={handleRename}
      validateName={(name, current) => validateKey(profiles, name, current)}
      addLabel="Add profile"
      renderDetail={(name) => (
        <ProfileForm
          profile={profiles[name] ?? {}}
          stageNames={stageNames}
          onChange={(next) => onChange({ ...profiles, [name]: next })}
        />
      )}
    />
  );
}
