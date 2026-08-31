/**
 * Pure, order-preserving operations on a named collection (a `[table.<name>]`
 * map). Kept separate from the editor component so the add/rename/remove
 * semantics are unit-testable without rendering.
 */
export type NamedMap<T> = Record<string, T>;

/** Returns `base`, or `base_2`, `base_3`… until unused. */
export function uniqueName<T>(map: NamedMap<T>, base: string): string {
  if (!(base in map)) return base;
  let i = 2;
  while (`${base}_${i}` in map) i++;
  return `${base}_${i}`;
}

export function addEntry<T>(map: NamedMap<T>, name: string, value: T): NamedMap<T> {
  return { ...map, [name]: value };
}

export function removeEntry<T>(map: NamedMap<T>, name: string): NamedMap<T> {
  const next = { ...map };
  delete next[name];
  return next;
}

/** Rename a key while preserving insertion order (objects iterate in order). */
export function renameEntry<T>(
  map: NamedMap<T>,
  oldName: string,
  newName: string,
): NamedMap<T> {
  if (!(oldName in map) || oldName === newName) return map;
  const next: NamedMap<T> = {};
  for (const [k, v] of Object.entries(map)) {
    next[k === oldName ? newName : k] = v;
  }
  return next;
}

/** Validate a proposed key against the map. Returns an error string or null. */
export function validateKey<T>(
  map: NamedMap<T>,
  name: string,
  currentName: string | null,
  pattern = /^[A-Za-z0-9_.-]+$/,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required";
  if (!pattern.test(trimmed)) return "Use letters, digits, _ . - only";
  if (trimmed !== currentName && trimmed in map) return `"${trimmed}" already exists`;
  return null;
}
