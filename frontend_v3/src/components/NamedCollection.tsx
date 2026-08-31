import { useState, type ReactNode } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

export interface NamedCollectionProps {
  /** Ordered entry keys (the `<name>` in `[table.<name>]`). */
  names: string[];
  selected: string | null;
  onSelect: (name: string) => void;
  onAdd: () => void;
  onRemove: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  /** Validate a proposed (new or renamed) key. Return an error string to reject. */
  validateName?: (name: string, currentName: string | null) => string | null;
  addLabel?: string;
  /**
   * Bounded collections (e.g. LLMs, whose entries must be backed by a registered
   * client implementation) disable structural edits — only params are editable.
   * Default open: all true.
   */
  canAdd?: boolean;
  canRename?: boolean;
  canRemove?: boolean;
  /** Detail editor for the selected entry. */
  renderDetail: (name: string) => ReactNode;
}

/**
 * Master/detail control for a dynamic, named collection such as `[llm.<name>]`,
 * `[encoders.<name>]`, `[profiles.<name>]`. Owns the add / remove / rename
 * interactions generically; the per-entry fields are supplied by `renderDetail`.
 */
export function NamedCollection({
  names,
  selected,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  validateName,
  addLabel = "Add",
  canAdd = true,
  canRename = true,
  canRemove = true,
  renderDetail,
}: NamedCollectionProps) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  function beginRename(name: string) {
    setRenaming(name);
    setDraft(name);
    setRenameError(null);
  }

  function commitRename() {
    if (renaming === null) return;
    const next = draft.trim();
    if (next === renaming) {
      setRenaming(null);
      return;
    }
    const err = validateName?.(next, renaming) ?? null;
    if (err) {
      setRenameError(err);
      return;
    }
    onRename(renaming, next);
    setRenaming(null);
  }

  return (
    <div className="grid grid-cols-[220px_1fr] gap-5">
      <aside className="flex flex-col gap-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Entries
          </span>
          {canAdd && (
            <Button size="sm" variant="ghost" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
              {addLabel}
            </Button>
          )}
        </div>

        {names.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted">None yet. Add one.</p>
        )}

        {names.map((name) => {
          const isRenaming = renaming === name;
          const isSelected = selected === name;
          return (
            <div
              key={name}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                isSelected
                  ? "bg-accent/15 text-foreground"
                  : "text-muted hover:bg-surface-raised",
              )}
            >
              {isRenaming ? (
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className="h-6 w-full rounded border border-border bg-surface-inset px-1.5 text-xs"
                    />
                    <button onClick={commitRename} aria-label="Confirm rename">
                      <Check className="h-3.5 w-3.5 text-ok" />
                    </button>
                    <button onClick={() => setRenaming(null)} aria-label="Cancel rename">
                      <X className="h-3.5 w-3.5 text-muted" />
                    </button>
                  </div>
                  {renameError && (
                    <span className="text-[11px] text-danger">{renameError}</span>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(name)}
                    className="flex-1 truncate text-left font-mono"
                  >
                    {name}
                  </button>
                  {canRename && (
                    <button
                      onClick={() => beginRename(name)}
                      aria-label={`Rename ${name}`}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted hover:text-foreground" />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => onRemove(name)}
                      aria-label={`Remove ${name}`}
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted hover:text-danger" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </aside>

      <section className="min-w-0">
        {selected && names.includes(selected) ? (
          renderDetail(selected)
        ) : (
          <p className="px-1 py-6 text-sm text-muted">
            Select an entry on the left, or add a new one.
          </p>
        )}
      </section>
    </div>
  );
}
