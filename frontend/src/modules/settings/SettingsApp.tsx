import { useState } from "react";
import { Gauge, KeyRound, Sparkles, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { appsClient } from "@/lib/apps";
import { Button } from "@/components/Button";
import { SwitchField } from "@/components/SwitchField";
import type { JiraUser } from "@/lib/contracts";

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

/** Settings — user preferences and the Jira connection (PAT). Admin engine
 * config stays in the Configuration slide-over. */
export function SettingsApp() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [pat, setPat] = useState("");
  const [jira, setJira] = useState<JiraUser | null>(null);
  const [connecting, setConnecting] = useState(false);

  function update(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  }

  async function connectJira() {
    setConnecting(true);
    const me = await appsClient.jiraMe();
    setJira(me);
    setConnecting(false);
  }

  return (
    <div className="min-h-full">
      <div className="glow-ambient border-b border-border px-6 pt-6 pb-5">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-xs text-muted">
          Your profile, integrations, and preferences. Engine configuration lives in
          Configuration.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
        {/* profile */}
        <Section icon={<User className="h-4 w-4" />} title="Profile">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-[13px] font-semibold text-accent-fg">
              {user?.initials ?? "—"}
            </div>
            <div>
              <div className="text-[13px] font-medium text-foreground">
                {user?.display_name ?? user?.username ?? "signed out"}
              </div>
              <div className="text-[11.5px] text-faint">
                {user?.username} · workspace {user?.workspace?.name}
              </div>
            </div>
          </div>
        </Section>

        {/* jira */}
        <Section icon={<KeyRound className="h-4 w-4" />} title="Jira integration">
          {jira ? (
            <div className="flex items-center gap-2 rounded-[9px] border border-ok/30 bg-ok/10 px-3 py-2.5">
              <Sparkles className="h-4 w-4 text-ok" />
              <span className="text-[12.5px] text-foreground">
                Connected as {jira.display_name}
                {jira.email && <span className="text-faint"> · {jira.email}</span>}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setJira(null)}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11.5px] text-muted">
                Paste a personal access token to pull tickets and epics into Codegen and
                the Planner. Stored encrypted by the backend; never shown again.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="Jira PAT"
                  className="min-w-[240px] flex-1 rounded-[9px] border border-border bg-surface-raised px-3 py-2 text-[12.5px] text-foreground outline-none transition placeholder:text-faint focus:border-accent/60"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void connectJira()}
                  disabled={connecting || pat.trim().length === 0}
                >
                  {connecting ? "Connecting…" : "Connect"}
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* preferences */}
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
      </div>
    </div>
  );
}

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
