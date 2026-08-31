import { useId } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { FieldShell, inputClass } from "./Field";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField({
  label,
  description,
  required,
  error,
  value,
  onChange,
  options,
  placeholder = "Select…",
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell
      label={label}
      description={description}
      required={required}
      error={error}
      htmlFor={id}
    >
      <Select.Root value={value || undefined} onValueChange={onChange}>
        <Select.Trigger
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(
            inputClass,
            "flex items-center justify-between",
            error && "border-danger",
          )}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-muted" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-50 min-w-[var(--radix-select-trigger-width)] rounded-md border border-border bg-surface-raised p-1 shadow-xl"
          >
            <Select.Viewport>
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-accent/20"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-accent" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </FieldShell>
  );
}
