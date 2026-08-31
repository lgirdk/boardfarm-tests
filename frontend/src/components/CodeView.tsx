import { useMemo, type ReactNode } from "react";

/**
 * Zero-dependency code viewer. Token colours match the design system: keywords
 * indigo, strings green, numbers/booleans amber, comments faint italic,
 * decorators & function names lilac (#C4A7F7). Supports python, json, toml, diff;
 * anything else renders plain. A library would add ~100kB for these colours.
 */

const PY_KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "class", "with",
  "as", "in", "not", "and", "or", "import", "from", "raise", "try", "except",
  "finally", "pass", "yield", "lambda", "async", "await", "assert", "global",
  "del", "is", "break", "continue",
]);
const PY_CONSTS = new Set(["None", "True", "False"]);
const LILAC = "text-[#C4A7F7]";

function span(key: number, cls: string, text: string): ReactNode {
  return (
    <span key={key} className={cls}>
      {text}
    </span>
  );
}

function highlightPython(code: string): ReactNode[] {
  const RE =
    /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|@[A-Za-z_][\w.]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let prev = "";
  for (const m of code.matchAll(RE)) {
    const tok = m[0];
    const start = m.index ?? 0;
    if (start > last) nodes.push(code.slice(last, start));
    if (tok.startsWith("#")) nodes.push(span(key++, "text-faint italic", tok));
    else if (/^("""|'''|"|')/.test(tok)) nodes.push(span(key++, "text-ok", tok));
    else if (tok[0] === "@") nodes.push(span(key++, LILAC, tok));
    else if (/^\d/.test(tok)) nodes.push(span(key++, "text-warning", tok));
    else if (PY_CONSTS.has(tok)) nodes.push(span(key++, "text-warning", tok));
    else if (PY_KEYWORDS.has(tok)) nodes.push(span(key++, "text-accent", tok));
    else if (prev === "def" || prev === "class") nodes.push(span(key++, LILAC, tok));
    else nodes.push(tok);
    prev = /^[A-Za-z_]/.test(tok) ? tok : "";
    last = start + tok.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

function highlightJson(code: string): ReactNode[] {
  const RE =
    /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|\/\/[^\n]*)/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of code.matchAll(RE)) {
    const tok = m[0];
    const start = m.index ?? 0;
    if (start > last) nodes.push(code.slice(last, start));
    if (tok.startsWith("//")) nodes.push(span(key++, "text-faint italic", tok));
    else if (/:$/.test(tok)) {
      const str = tok.replace(/\s*:$/, "");
      nodes.push(span(key++, "text-muted", str));
      nodes.push(tok.slice(str.length));
    } else if (tok[0] === '"') nodes.push(span(key++, "text-ok", tok));
    else nodes.push(span(key++, "text-warning", tok));
    last = start + tok.length;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

function highlightValue(text: string, nextKey: () => number): ReactNode[] {
  const RE = /("(?:\\.|[^"\\])*"|'[^']*'|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b)/g;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const tok = m[0];
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    if (tok[0] === '"' || tok[0] === "'") out.push(span(nextKey(), "text-ok", tok));
    else out.push(span(nextKey(), "text-warning", tok));
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function highlightToml(code: string): ReactNode[] {
  let key = 0;
  const k = () => key++;
  return code.split("\n").map((line, i) => {
    const nl = i > 0 ? "\n" : "";
    if (line.trim().startsWith("#"))
      return (
        <span key={k()}>
          {nl}
          <span className="text-faint italic">{line}</span>
        </span>
      );
    if (/^\s*\[.*\]\s*$/.test(line))
      return (
        <span key={k()}>
          {nl}
          <span className="text-accent">{line}</span>
        </span>
      );
    const kv = line.match(/^(\s*)([A-Za-z_][\w.-]*)(\s*=\s*)([\s\S]*)$/);
    if (kv)
      return (
        <span key={k()}>
          {nl}
          {kv[1]}
          <span className="text-accent">{kv[2]}</span>
          {kv[3]}
          {highlightValue(kv[4] ?? "", k)}
        </span>
      );
    return (
      <span key={k()}>
        {nl}
        {line}
      </span>
    );
  });
}

function highlightDiff(code: string): ReactNode[] {
  let key = 0;
  return code.split("\n").map((line, i) => {
    const nl = i > 0 ? "\n" : "";
    let cls = "";
    if (/^\+/.test(line)) cls = "text-ok";
    else if (/^-/.test(line)) cls = "text-danger";
    else if (/^@@/.test(line)) cls = "text-running";
    return cls ? (
      <span key={key++}>
        {nl}
        <span className={cls}>{line}</span>
      </span>
    ) : (
      <span key={key++}>
        {nl}
        {line}
      </span>
    );
  });
}

export interface CodeViewProps {
  code: string;
  /** "python" | "json" | "toml" | "diff" get highlighting; anything else is plain. */
  language?: string;
  className?: string;
}

export function CodeView({ code, language, className }: CodeViewProps) {
  const rendered = useMemo(() => {
    switch (language) {
      case "python":
        return highlightPython(code);
      case "json":
        return highlightJson(code);
      case "toml":
        return highlightToml(code);
      case "diff":
        return highlightDiff(code);
      default:
        return code;
    }
  }, [code, language]);
  return (
    <pre
      className={
        "overflow-x-auto rounded-[9px] border border-border bg-surface-inset p-[13px] font-mono text-[11.5px] leading-[1.75] text-foreground " +
        (className ?? "")
      }
    >
      {rendered}
    </pre>
  );
}
