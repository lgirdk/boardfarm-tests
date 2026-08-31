import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { FieldShell, inputClass } from "./Field";
import { cn } from "@/lib/cn";

export interface ReorderableListProps {
  label: string;
  description?: string;
  error?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

/**
 * Ordered list editor where position is meaningful (e.g. repo_priority_order —
 * first = highest priority). Move up/down + add/remove. Deliberately uses
 * buttons rather than drag-and-drop to stay dependency-light and accessible.
 */
export function ReorderableList({
  label,
  description,
  error,
  value,
  onChange,
  placeholder = "value",
}: ReorderableListProps) {
  function setAt(index: number, next: string) {
    const copy = [...value];
    copy[index] = next;
    onChange(copy);
  }
  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const copy = [...value];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    onChange(copy);
  }

  return (
    <FieldShell label={label} description={description} error={error}>
      <div className="flex flex-col gap-1.5">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-5 select-none text-right font-mono text-xs text-muted">
              {i + 1}
            </span>
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => setAt(i, e.target.value)}
              className={cn(inputClass, "h-8")}
            />
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              className="text-muted hover:text-foreground disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              aria-label="Move down"
              className="text-muted hover:text-foreground disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => removeAt(i)}
              aria-label="Remove"
              className="text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="ghost" onClick={() => onChange([...value, ""])}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>
    </FieldShell>
  );
}
