import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldShellProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

/**
 * Presentational wrapper: label, optional help text, the control, and
 * a validation error. Every field control composes this.
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
        className="flex items-center gap-1 text-[13px] font-medium text-foreground"
      >
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      {description && (
        <p className="text-[12px] leading-relaxed text-muted">{description}</p>
      )}
      {children}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}

/** V3 shared input styling. */
export const inputClass = cn(
  "w-full rounded-[11px] border border-border bg-surface-raised px-[14px] py-[10px] text-[13.5px]",
  "text-foreground placeholder:text-faint",
  "focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_var(--focus-ring)]",
  "disabled:opacity-50",
);
