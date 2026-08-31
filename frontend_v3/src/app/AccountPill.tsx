import { LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";

export interface AccountPillProps {
  onOpenSettings: () => void;
}

/**
 * Fixed top-right pill showing avatar + username. Opens the account drawer
 * (settings, Jira token, engine configuration).
 */
export function AccountPill({ onOpenSettings }: AccountPillProps) {
  const { user, logout } = useAuth();

  return (
    <div className="fixed right-5 top-[14px] z-[60] flex items-center gap-[9px] rounded-full border border-border bg-surface/80 px-[13px] py-[6px] pl-[6px] backdrop-blur-[10px] transition-all duration-[160ms] hover:border-border-strong hover:bg-surface-raised">
      <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-gradient-to-br from-accent/80 to-accent text-[10.5px] font-semibold text-accent-fg">
        {user?.initials ?? "—"}
      </div>
      <span className="text-[12.5px] text-muted">
        {user?.username ?? "signed out"}
      </span>
      {user?.role === "admin" && (
        <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium text-accent">
          admin
        </span>
      )}
      <button
        onClick={onOpenSettings}
        title="Settings & configuration"
        className="text-faint transition hover:text-foreground"
      >
        <Settings className="h-[14px] w-[14px]" />
      </button>
      <button
        onClick={() => void logout()}
        title="Sign out"
        className="text-faint transition hover:text-foreground"
      >
        <LogOut className="h-[14px] w-[14px]" />
      </button>
    </div>
  );
}
