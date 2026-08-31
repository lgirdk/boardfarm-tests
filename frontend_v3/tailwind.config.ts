import type { Config } from "tailwindcss";

/**
 * V3 design system. All colors resolve through CSS variables (src/index.css).
 * The rgb(var(--x) / <alpha-value>) form preserves Tailwind opacity modifiers.
 *
 * Semantic rule: ok/danger/running/warning are STATUS colors only; `accent`
 * (indigo) is the only interactive color. Area colors are for identity only.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          "2": "rgb(var(--bg2) / <alpha-value>)",
        },
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          inset: "rgb(var(--surface-inset) / <alpha-value>)",
          "3": "rgb(var(--surface-3) / <alpha-value>)",
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
          "2": "rgb(var(--accent2) / <alpha-value>)",
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
        // Area identity colors
        "area-docsis": "rgb(var(--area-docsis) / <alpha-value>)",
        "area-voice": "rgb(var(--area-voice) / <alpha-value>)",
        "area-wifi": "rgb(var(--area-wifi) / <alpha-value>)",
        "area-tr069": "rgb(var(--area-tr069) / <alpha-value>)",
        "area-net": "rgb(var(--area-net) / <alpha-value>)",
        "area-prov": "rgb(var(--area-prov) / <alpha-value>)",
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
        display: [
          "Space Grotesk",
          "Inter",
          "system-ui",
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
      borderRadius: {
        card: "16px",
        tile: "22px",
      },
    },
  },
  plugins: [],
} satisfies Config;
