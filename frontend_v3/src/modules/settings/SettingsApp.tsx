import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Gauge,
  Globe,
  KeyRound,
  Link2,
  Palette,
  Server,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";
import { SwitchField } from "@/components/SwitchField";
import {
  getJiraConfig,
  updateJiraConfig,
  getJiraConnection,
  connectJira,
  disconnectJira,
} from "@/lib/jira/config";
import type { JiraDeployment, JiraAuthMethod, JiraWorkspaceConfig, JiraConnection } from "@/lib/contracts";
import { cn } from "@/lib/cn";

const PREFS_KEY = "bf-prefs";

interface Prefs {
  autoScrollLogs: boolean;
  notifyOnComplete: boolean;
  compactDensity: boolean;
}

function loadPrefs(): Prefs {
  try {
    return {
      autoScrollLogs: true,
      notifyOnComplete: true,
      compactDensity: false,
      ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"),
    };
  } catch {
    return { autoScrollLogs: true, notifyOnComplete: true, compactDensity: false };
  }
}

/**
 * Settings — user profile, connected apps, preferences, theme.
 * Admin users also see an "Administration" section for workspace-level config.
 */
export function SettingsApp() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const isAdmin = user?.role === "admin";

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-xs text-muted">
          Your profile, connected apps, and preferences.
          {isAdmin && " Workspace administration is at the bottom."}
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        {/* ── Profile ─────────────────────────────────────────── */}
        <Section icon={<User className="h-4 w-4" />} title="Profile">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-[13px] font-semibold text-accent-fg">
              {user?.initials ?? "—"}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                {user?.display_name ?? user?.username ?? "signed out"}
                {isAdmin && (
                  <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                    admin
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-faint">
                {user?.username} · workspace {user?.workspace?.name}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Connected apps (user-level) ─────────────────────── */}
        <Section icon={<Link2 className="h-4 w-4" />} title="Connected apps">
          <JiraUserConnection />
        </Section>

        {/* ── Theme ───────────────────────────────────────────── */}
        <Section icon={<Palette className="h-4 w-4" />} title="Theme">
          <ThemePicker />
        </Section>

        {/* ── Preferences ─────────────────────────────────────── */}
        <Section icon={<Gauge className="h-4 w-4" />} title="Preferences">
          <div className="divide-y divide-border/60">
            <div className="py-1">
              <SwitchField
                label="Auto-scroll run logs"
                description="Follow boardfarm output as it streams during a run."
                value={prefs.autoScrollLogs}
                onChange={(v) => update({ autoScrollLogs: v })}
              />
            </div>
            <div className="py-1">
              <SwitchField
                label="Notify on run completion"
                description="A desktop notification when a run finishes or needs you."
                value={prefs.notifyOnComplete}
                onChange={(v) => update({ notifyOnComplete: v })}
              />
            </div>
            <div className="py-1">
              <SwitchField
                label="Compact density"
                description="Tighter spacing across tables and lists."
                value={prefs.compactDensity}
                onChange={(v) => update({ compactDensity: v })}
              />
            </div>
          </div>
        </Section>

        {/* ── Administration (admin-only) ─────────────────────── */}
        {isAdmin && (
          <>
            <div className="flex items-center gap-2 pt-4">
              <Shield className="h-4 w-4 text-accent" />
              <h2 className="text-[13px] font-semibold text-foreground">Administration</h2>
              <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9.5px] text-accent">
                admin only
              </span>
            </div>
            <Section icon={<Settings className="h-4 w-4" />} title="Jira integration">
              <JiraAdminConfig />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * JIRA — USER CONNECTION
 * ═══════════════════════════════════════════════════════════════════════ */

function JiraUserConnection() {
  const [config] = useState<JiraWorkspaceConfig>(getJiraConfig);
  const [conn, setConn] = useState<JiraConnection>(getJiraConnection);
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);

  if (!config.enabled) {
    return (
      <div className="rounded-[9px] border border-dashed border-border px-3 py-4 text-center text-[12px] text-faint">
        Jira integration is not configured for this workspace. Ask your admin to set it up.
      </div>
    );
  }

  async function handleConnect() {
    setBusy(true);
    const result = await connectJira("pat", pat);
    setConn(result);
    setPat("");
    setBusy(false);
  }

  async function handleDisconnect() {
    setBusy(true);
    const result = await disconnectJira();
    setConn(result);
    setBusy(false);
  }

  if (conn.connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-[9px] border border-ok/30 bg-ok/10 px-3 py-2.5">
          <Check className="h-4 w-4 text-ok" />
          <div className="flex-1">
            <span className="text-[12.5px] font-medium text-foreground">
              Connected as {conn.display_name ?? conn.username}
            </span>
            <div className="text-[10.5px] text-faint">
              via {conn.method === "pat" ? "Personal Access Token" : "OAuth"} ·{" "}
              {config.deployment === "data_center" ? config.base_url : "Jira Cloud"} ·{" "}
              connected {conn.connected_at ? new Date(conn.connected_at).toLocaleDateString() : ""}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDisconnect()}
            disabled={busy}
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // Show connection form based on what admin allowed
  const showPat = config.allowed_auth.includes("pat");
  const showOAuth = config.allowed_auth.includes("oauth");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <KeyRound className="h-3.5 w-3.5" />
        {config.deployment === "data_center"
          ? `Connect to ${config.base_url ?? "Jira Data Center"}`
          : "Connect to Jira Cloud"}
      </div>

      {showPat && (
        <div className="space-y-2">
          <p className="text-[11.5px] text-muted">
            Paste a personal access token. It is sent to the backend and stored encrypted — never
            visible again after you connect.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Jira Personal Access Token"
              className="min-w-[240px] flex-1 rounded-[9px] border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-foreground outline-none transition placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--focus-ring)]"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleConnect()}
              disabled={busy || pat.trim().length === 0}
            >
              {busy ? "Connecting…" : "Test & connect"}
            </Button>
          </div>
        </div>
      )}

      {showOAuth && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleConnect()}
          disabled={busy}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {busy ? "Connecting…" : "Connect with Atlassian"}
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * JIRA — ADMIN WORKSPACE CONFIG
 * ═══════════════════════════════════════════════════════════════════════ */

function JiraAdminConfig() {
  const [config, setConfig] = useState<JiraWorkspaceConfig>(getJiraConfig);
  const [dirty, setDirty] = useState(false);

  function patch(p: Partial<JiraWorkspaceConfig>) {
    const next = { ...config, ...p };
    setConfig(next);
    setDirty(true);
  }

  function save() {
    updateJiraConfig(config);
    setDirty(false);
  }

  function toggleAuth(method: JiraAuthMethod) {
    const has = config.allowed_auth.includes(method);
    const next = has
      ? config.allowed_auth.filter((m) => m !== method)
      : [...config.allowed_auth, method];
    if (next.length === 0) return; // must have at least one
    patch({ allowed_auth: next });
  }

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-muted">
        Configure how your workspace connects to Jira. This affects all users.
      </p>

      {/* Enabled toggle */}
      <SwitchField
        label="Jira integration enabled"
        description="When off, users cannot connect and Jira features are hidden."
        value={config.enabled}
        onChange={(v) => patch({ enabled: v })}
      />

      {config.enabled && (
        <>
          {/* Deployment type */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
              Deployment type
            </div>
            <div className="flex gap-2">
              {([
                { id: "cloud" as JiraDeployment, label: "Jira Cloud", icon: Globe, desc: "*.atlassian.net — OAuth via Atlassian" },
                { id: "data_center" as JiraDeployment, label: "Data Center / Server", icon: Server, desc: "Self-hosted — PAT or OAuth 2.0" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    const authDefaults: JiraAuthMethod[] = opt.id === "cloud" ? ["oauth"] : ["pat"];
                    patch({
                      deployment: opt.id,
                      allowed_auth: authDefaults,
                      base_url: opt.id === "cloud" ? undefined : config.base_url,
                    });
                  }}
                  className={cn(
                    "flex flex-1 items-start gap-2.5 rounded-[10px] border p-3 text-left transition-all duration-[160ms]",
                    config.deployment === opt.id
                      ? "border-accent/60 bg-accent/[0.07]"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <opt.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  <div>
                    <div className="text-[12.5px] font-medium text-foreground">{opt.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-faint">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Base URL (Data Center only) */}
          {config.deployment === "data_center" && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
                Jira base URL
              </div>
              <input
                type="url"
                value={config.base_url ?? ""}
                onChange={(e) => patch({ base_url: e.target.value })}
                placeholder="https://jira.company.com"
                className="w-full rounded-[9px] border border-border bg-surface-raised px-3 py-2 font-mono text-[12px] text-foreground outline-none transition placeholder:text-faint focus:border-accent/60 focus:shadow-[0_0_0_3px_var(--focus-ring)]"
              />
              <p className="mt-1 text-[10.5px] text-faint">
                The URL users visit to access Jira. API calls go to {"{base_url}"}/rest/api/2/...
              </p>
            </div>
          )}

          {/* Cloud OAuth config */}
          {config.deployment === "cloud" && (
            <div className="rounded-[9px] border border-border bg-surface-raised/50 px-3 py-2.5">
              <p className="text-[11.5px] text-muted">
                For Jira Cloud, register an OAuth 2.0 app at{" "}
                <span className="font-mono text-accent">developer.atlassian.com</span>, then
                paste the client ID and secret in the backend environment variables
                (JIRA_CLIENT_ID, JIRA_CLIENT_SECRET). The frontend does not handle these.
              </p>
            </div>
          )}

          {/* Allowed auth methods */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
              Allowed authentication methods
            </div>
            <div className="flex gap-2">
              {([
                { id: "oauth" as JiraAuthMethod, label: "OAuth 2.0", desc: "User clicks Connect → redirected to Jira → auto" },
                { id: "pat" as JiraAuthMethod, label: "Personal Access Token", desc: "User pastes a token → validated against Jira" },
              ]).map((opt) => {
                const active = config.allowed_auth.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleAuth(opt.id)}
                    className={cn(
                      "flex flex-1 items-start gap-2.5 rounded-[10px] border p-3 text-left transition-all duration-[160ms]",
                      active
                        ? "border-accent/60 bg-accent/[0.07]"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        active
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border-strong",
                      )}
                    >
                      {active && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-[12.5px] font-medium text-foreground">{opt.label}</div>
                      <div className="mt-0.5 text-[10.5px] text-faint">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          {dirty && (
            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <span className="text-[11px] text-faint">Unsaved changes</span>
              <Button variant="primary" size="sm" onClick={save}>
                Save configuration
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * THEME PICKER
 * ═══════════════════════════════════════════════════════════════════════ */

const THEME_KEY = "bf-theme";
type ThemeId = "classic" | "blueprint" | "evergreen";

const THEMES: { id: ThemeId; name: string; accent: string; bg: string; desc: string }[] = [
  {
    id: "classic",
    name: "Classic dark",
    accent: "#7C8CFF",
    bg: "#080A0F",
    desc: "Indigo/violet on deep dark — the original boardfarm look",
  },
  {
    id: "blueprint",
    name: "Blueprint",
    accent: "#0B4A73",
    bg: "#EDF1F5",
    desc: "Cool blue-grey paper with drafting blue — technical precision",
  },
  {
    id: "evergreen",
    name: "Evergreen",
    accent: "#1B4332",
    bg: "#ECF5ED",
    desc: "Soft mint with deep forest accent — calm, natural, soothing",
  },
];

function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(THEME_KEY) as ThemeId | null;
    return stored && THEMES.some((t) => t.id === stored) ? stored : "classic";
  });

  useEffect(() => {
    if (theme === "classic") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  return (
    <div className="flex gap-3">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={cn(
            "flex-1 rounded-[10px] border p-3 text-left transition-all duration-[160ms]",
            theme === t.id
              ? "border-accent/60 bg-accent/[0.07]"
              : "border-border hover:border-border-strong",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: t.bg, border: `2px solid ${t.accent}` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.accent }} />
            </span>
            <span className="text-[12.5px] font-medium text-foreground">{t.name}</span>
          </div>
          <div className="mt-1 text-[11px] text-faint">{t.desc}</div>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * SECTION WRAPPER
 * ═══════════════════════════════════════════════════════════════════════ */

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-muted">
        {icon}
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}
