import type { Config } from "tailwindcss";

/**
 * Instrument-panel design system. All colors resolve through CSS variables
 * (see src/index.css) so the theme is swappable without component changes.
 * The rgb(var(--x) / <alpha-value>) form preserves opacity modifiers
 * (bg-accent/15, bg-warning/10, ...).
 *
 * Semantic rule: ok/danger/running/warning are STATUS colors only; `accent`
 * (indigo) is the only interactive color.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          inset: "rgb(var(--surface-inset) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          fg: "rgb(var(--accent-fg) / <alpha-value>)",
        },
        highlight: {
          DEFAULT: "rgb(var(--highlight) / <alpha-value>)",
          fg: "rgb(var(--highlight-fg) / <alpha-value>)",
        },
        ok: "rgb(var(--ok) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        running: "rgb(var(--running) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        idle: "rgb(var(--idle) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
