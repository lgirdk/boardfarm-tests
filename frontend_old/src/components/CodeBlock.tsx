import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./Button";

export interface CodeBlockProps {
  code: string;
  /** Optional caption shown above the block (e.g. a filename). */
  caption?: string;
}

/** Monospace code viewer with a copy-to-clipboard button. */
export function CodeBlock({ code, caption }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-inset">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="font-mono text-xs text-muted">{caption ?? "output"}</span>
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-ok" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
        {code}
      </pre>
    </div>
  );
}
