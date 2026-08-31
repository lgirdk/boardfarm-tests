/** Read a dotted path from an object tree (e.g. "store.stub_registry"). */
export function getAtPath(root: Record<string, unknown>, path: string): unknown {
  if (path === "") return root;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, root);
}

/** Return a shallow-cloned tree with `value` set at a dotted path. */
export function setAtPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  if (path === "") return value as Record<string, unknown>;
  const keys = path.split(".");
  const next = { ...root };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    const child = cursor[key];
    cursor[key] = child && typeof child === "object" ? { ...(child as object) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]!] = value;
  return next;
}
