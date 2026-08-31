import { useId, type InputHTMLAttributes } from "react";
import { FieldShell, inputClass } from "./Field";
import { cn } from "@/lib/cn";

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
}

export function TextField({
  label,
  description,
  required,
  error,
  value,
  onChange,
  className,
  multiline,
  rows = 3,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const sharedClass = cn(
    inputClass,
    error && "border-danger",
    rest.readOnly && "cursor-not-allowed text-muted",
    multiline && "h-auto py-2 leading-relaxed",
    className,
  );
  return (
    <FieldShell
      label={label}
      description={description}
      required={required}
      error={error}
      htmlFor={id}
    >
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          readOnly={rest.readOnly}
          placeholder={rest.placeholder}
          className={sharedClass}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={sharedClass}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
