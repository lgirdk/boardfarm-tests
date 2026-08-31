import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldShellProps {
  label: string;
  /** Help text — sourced from the schema layer (TOML comments), never hardcoded in JSX. */
  description?: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Presentational wrapper that lays out a label, optional help text, the control,
 * and a validation error. Every concrete field control composes this so the
 * label/help/error treatment is identical across the whole form engine.
 */
export function FieldShell({
  label,
  description,
  required,
  error,
  htmlFor,
  children,
}: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground flex items-center gap-1"
      >
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {description && (
        <p className="text-xs text-muted leading-relaxed">{description}</p>
      )}
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Shared input styling so TextField and others look identical. */
export const inputClass = cn(
  "h-9 w-full rounded-md bg-surface-inset border border-border px-3 text-sm",
  "text-foreground placeholder:text-muted/60",
  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40",
  "disabled:opacity-50",
);
