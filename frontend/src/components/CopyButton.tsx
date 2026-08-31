import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./Button";

/** Copy-to-clipboard button with a brief confirmation state. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button size="sm" variant="ghost" onClick={() => void copy()}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-ok" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
