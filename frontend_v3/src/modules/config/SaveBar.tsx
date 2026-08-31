import { useState } from "react";
import { Button } from "@/components/Button";
import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import type { UseConfigDoc } from "./useConfigDoc";

export interface SaveBarProps {
  doc: UseConfigDoc;
  /** Display name of the file being edited, e.g. "configs/app.toml". */
  fileName: string;
}

/**
 * Sticky action bar for a config surface: dirty indicator, reset, and a
 * diff-gated save. Save always routes through the review dialog.
 */
export function SaveBar({ doc, fileName }: SaveBarProps) {
  const [reviewOpen, setReviewOpen] = useState(false);

  async function confirmSave() {
    const result = await doc.save();
    if (result.ok) setReviewOpen(false);
  }

  return (
    <div className="sticky bottom-0 mt-6 flex items-center justify-between border-t border-border bg-surface/95 px-1 py-3 backdrop-blur">
      <span className="text-xs text-muted">
        {doc.dirty ? "Unsaved changes" : "No changes"} · {fileName}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={doc.reset} disabled={!doc.dirty}>
          Reset
        </Button>
        <Button
          variant="primary"
          onClick={() => setReviewOpen(true)}
          disabled={!doc.dirty}
        >
          Review &amp; save
        </Button>
      </div>

      <ConfirmSaveDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        fileName={fileName}
        before={doc.beforeToml}
        after={doc.afterToml}
        saving={doc.saving}
        onConfirm={confirmSave}
      />
    </div>
  );
}
