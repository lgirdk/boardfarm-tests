import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { RecordForm } from "@/components/RecordForm";
import { stepSchema, newStep } from "./codegenInput";
import type { ConfigRecord } from "@/lib/schema/types";

export interface StepsEditorProps {
  steps: ConfigRecord[];
  errors: Record<string, string>[];
  onChange: (steps: ConfigRecord[]) => void;
}

/**
 * Ordered editor for the structured test steps. Each step is a small record
 * form; the step number is derived from position (shown here, assigned on
 * submit), so reordering renumbers automatically.
 */
export function StepsEditor({ steps, errors, onChange }: StepsEditorProps) {
  function update(index: number, next: ConfigRecord) {
    onChange(steps.map((s, i) => (i === index ? next : s)));
  }
  function remove(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const copy = [...steps];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    onChange(copy);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Steps
        </span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...steps, newStep()])}>
          <Plus className="h-3.5 w-3.5" />
          Add step
        </Button>
      </div>

      {steps.length === 0 && (
        <p className="text-xs text-muted">No steps yet. Add one.</p>
      )}

      {steps.map((step, i) => (
        <div
          key={i}
          className="rounded-md border border-border bg-surface-raised/40 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm text-foreground">Step {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label="Move step up"
                className="text-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === steps.length - 1}
                aria-label="Move step down"
                className="text-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(i)}
                aria-label="Remove step"
                className="text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <RecordForm
            fields={stepSchema.fields}
            record={step}
            errors={errors[i] ?? {}}
            onChange={(key, value) => update(i, { ...step, [key]: value })}
          />
        </div>
      ))}
    </div>
  );
}
