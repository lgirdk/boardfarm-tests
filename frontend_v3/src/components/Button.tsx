import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "btn-primary hover:-translate-y-px",
  secondary:
    "btn-secondary text-foreground hover:-translate-y-px",
  ghost:
    "border border-transparent bg-transparent text-muted hover:text-foreground hover:bg-[var(--btn-ghost-hover)]",
  danger:
    "bg-transparent text-danger hover:bg-danger/10",
};

const SIZE: Record<Size, string> = {
  sm: "px-[11px] py-[6px] text-[12px] gap-2 rounded-[9px]",
  md: "px-[15px] py-[9px] text-[13px] gap-2 rounded-[11px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, type, ...rest }, ref) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center whitespace-nowrap transition-all duration-[160ms]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--focus-ring)]",
        "disabled:opacity-55 disabled:pointer-events-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
