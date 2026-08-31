import { useMemo, type ReactNode } from "react";

/**
 * Zero-dependency code viewer with just-enough Python highlighting, matching
 * the concept art's token colors: keywords indigo, strings/comments low,
 * numbers amber, names hi. A library would add ~100kB for four colors.
 */

const PY_KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "class", "with",
  "as", "in", "not", "and", "or", "None", "True", "False", "import", "from",
  "raise", "try", "except", "finally", "pass", "yield", "lambda", "async",
  "await", "assert", "global", "del", "is", "break", "continue",
]);

const TOKEN_RE =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

function highlightPython(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of code.matchAll(TOKEN_RE)) {
    const token = match[0];
    const start = match.index;
    if (start > last) nodes.push(code.slice(last, start));
    if (token.startsWith("#") || /^("""|'''|"|')/.test(token)) {
      nodes.push(
        <span key={key++} className="text-faint">
          {token}
        </span>,
      );
    } else if (/^\d/.test(token)) {
      nodes.push(
        <span key={key++} className="text-warning">
          {token}
        </span>,
      );
    } else if (PY_KEYWORDS.has(token)) {
      nodes.push(
        <span key={key++} className="text-accent">
          {token}
        </span>,
      );
    } else {
      nodes.push(token);
    }
    last = start + token.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export interface CodeViewProps {
  code: string;
  /** "python" gets highlighting; anything else renders plain. */
  language?: string;
  className?: string;
}

export function CodeView({ code, language, className }: CodeViewProps) {
  const rendered = useMemo(
    () => (language === "python" ? highlightPython(code) : code),
    [code, language],
  );
  return (
    <pre
      className={
        "overflow-x-auto rounded-lg border border-border bg-surface-inset px-3 py-2.5 font-mono text-[11.5px] leading-[1.7] text-muted " +
        (className ?? "")
      }
    >
      {rendered}
    </pre>
  );
}
