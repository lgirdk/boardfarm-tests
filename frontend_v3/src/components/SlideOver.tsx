import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "./Button";

export interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}

/**
 * V3 right-anchored slide-over panel built on Radix Dialog (focus trap + a11y).
 * Drawer is display:flex flex-col; header/body/footer are direct flex children
 * so the footer stays pinned and the body scrolls.
 * Uses glass tokens so the veil/shadow adapt to light/dark.
 */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  widthClass = "w-[min(780px,95vw)]",
}: SlideOverProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="so-veil fixed inset-0 z-[70]" style={{ background: "var(--glass-veil)" }} />
        <Dialog.Content
          className={`so-panel fixed right-0 top-0 z-[80] flex h-screen ${widthClass} flex-col border-l border-border-strong bg-surface shadow-[-26px_0_64px_rgba(0,0,0,.25)] focus:outline-none`}
          onInteractOutside={(event) => {
            const target = event.target as Element | null;
            const popperOpen =
              !!document.querySelector("[data-radix-popper-content-wrapper]") ||
              !!target?.closest("[data-radix-popper-content-wrapper]");
            if (popperOpen) event.preventDefault();
          }}
        >
          {/* Header — flex:none */}
          <header className="flex items-start justify-between gap-4 border-b border-border px-[22px] py-[18px]">
            <div className="flex flex-col gap-0.5">
              <Dialog.Title className="text-[15px] font-semibold">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-[11.5px] text-faint">
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

          {/* Body — flex:1 overflow-y:auto */}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {/* Footer — flex:none, pinned bottom */}
          {footer && (
            <footer className="border-t border-border px-[22px] py-[15px]" style={{ background: "var(--glass-footer)" }}>
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
