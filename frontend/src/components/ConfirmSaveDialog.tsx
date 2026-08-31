import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./Button";
import { DiffView } from "./DiffView";

export interface ConfirmSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  before: string;
  after: string;
  saving?: boolean;
  onConfirm: () => void;
}

/**
 * Mandatory pre-write review: shows the exact TOML diff about to hit disk and
 * requires explicit confirmation. Config controls a live pipeline, so no save
 * happens without the user seeing this.
 */
export function ConfirmSaveDialog({
  open,
  onOpenChange,
  fileName,
  before,
  after,
  saving,
  onConfirm,
}: ConfirmSaveDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] flex max-h-[80vh] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface shadow-2xl">
          <header className="border-b border-border px-5 py-4">
            <Dialog.Title className="text-base font-semibold">
              Review changes
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted">
              These edits will be written to{" "}
              <code className="font-mono text-foreground">{fileName}</code>.
            </Dialog.Description>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <DiffView before={before} after={after} />
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={onConfirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm & save"}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
