import { useId } from "react";
import * as Switch from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export interface SwitchFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Boolean control. Lays the label/help out inline-left with the toggle on the
 * right, which reads better than a stacked field for booleans.
 */
export function SwitchField({
  label,
  description,
  value,
  onChange,
}: SwitchFieldProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted leading-relaxed">{description}</p>
        )}
      </div>
      <Switch.Root
        id={id}
        checked={value}
        onCheckedChange={onChange}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border border-border transition",
          "data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-inset",
        )}
      >
        <Switch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </div>
  );
}
