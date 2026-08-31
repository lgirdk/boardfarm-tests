import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional footer (actions) pinned to the bottom. */
  footer?: ReactNode;
  children: ReactNode;
  /** Tailwind width class for the panel. */
  widthClass?: string;
}

/**
 * Right-anchored slide-over panel built on Radix Dialog (focus trap + a11y for
 * free). Used to host the Config "settings" application without it occupying a
 * primary nav slot.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  widthClass = "w-[min(900px,92vw)]",
}: SlideOverProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className={`fixed inset-y-0 right-0 z-50 flex ${widthClass} flex-col border-l border-border bg-surface shadow-2xl focus:outline-none`}
          // Radix Select/popper content is portaled OUTSIDE this panel, so any
          // interaction with an open dropdown (clicking an item OR clicking
          // empty space to dismiss it) looks like an "outside click" and would
          // close the slide-over. Rule: while ANY popper is open, never let the
          // panel close from an outside interaction — the click belongs to the
          // dropdown. At pointer-down time the popper is still mounted.
          onInteractOutside={(event) => {
            const target = event.target as Element | null;
            const popperOpen =
              !!document.querySelector("[data-radix-popper-content-wrapper]") ||
              !!target?.closest("[data-radix-popper-content-wrapper]");
            if (popperOpen) event.preventDefault();
          }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="text-base font-semibold">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer && (
            <footer className="border-t border-border px-5 py-3">{footer}</footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
