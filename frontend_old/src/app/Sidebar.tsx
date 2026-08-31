import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, TestTube2 } from "lucide-react";
import { NAV_SECTIONS, appsInSection, type Application } from "./registry";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const COLLAPSE_KEY = "sidebar-collapsed";

export interface SidebarProps {
  onOpenSettings: () => void;
}

/**
 * Left navigation: three labeled sections rendered from the registry, a
 * collapse toggle (state remembered), and the user chip pinned to the bottom.
 * kind:"settings" entries render as buttons that open the slide-over.
 */
export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable
    }
  }

  return (
    <nav
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[52px]" : "w-[176px]",
      )}
    >
      {/* brand + collapse */}
      <div className={cn("flex items-center gap-2 px-2.5 pb-3 pt-3.5", collapsed && "justify-center px-0")}>
        <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent">
          <TestTube2 className="h-3 w-3 text-accent-fg" />
        </div>
        {!collapsed && (
          <>
            <span className="text-[13px] font-medium text-foreground">INTA</span>
            <button
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="ml-auto text-faint transition hover:text-foreground"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {collapsed && (
        <button
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          className="mx-auto mb-1 text-faint transition hover:text-foreground"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}

      {/* sections */}
      <div className="flex-1 overflow-y-auto px-2">
        {NAV_SECTIONS.map((section) => {
          const entries = appsInSection(section.id);
          if (entries.length === 0) return null;
          return (
            <div key={section.id}>
              {!collapsed && (
                <div className="px-2 pb-1 pt-3 text-[11px] tracking-[0.06em] text-faint">
                  {section.label}
                </div>
              )}
              {collapsed && <div className="mx-2 my-2 border-t border-border" />}
              {entries.map((app) => (
                <NavItem
                  key={app.id}
                  app={app}
                  collapsed={collapsed}
                  onOpenSettings={onOpenSettings}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* user chip */}
      <div
        className={cn(
          "flex items-center gap-2 border-t border-border p-2",
          collapsed && "flex-col",
        )}
      >
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-muted"
          title={user?.username}
        >
          {user?.initials ?? "—"}
        </div>
        {!collapsed && (
          <span className="min-w-0 truncate text-xs text-muted">
            {user?.username ?? "signed out"}
          </span>
        )}
        <button
          onClick={() => void logout()}
          aria-label="Sign out"
          title="Sign out"
          className={cn("text-faint transition hover:text-foreground", !collapsed && "ml-auto")}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}

function NavItem({
  app,
  collapsed,
  onOpenSettings,
}: {
  app: Application;
  collapsed: boolean;
  onOpenSettings: () => void;
}) {
  const Icon = app.icon;
  const base = cn(
    "flex w-full items-center gap-2 rounded-[7px] px-2 py-[7px] text-[12.5px] transition",
    collapsed && "justify-center px-0",
  );

  if (app.kind === "settings") {
    return (
      <button
        onClick={onOpenSettings}
        title={collapsed ? app.name : undefined}
        className={cn(base, "text-muted hover:bg-surface hover:text-foreground")}
      >
        <Icon className="h-[15px] w-[15px] shrink-0" />
        {!collapsed && app.name}
      </button>
    );
  }

  return (
    <NavLink
      to={`/${app.path}`}
      end={app.path === ""}
      title={collapsed ? app.name : undefined}
      className={({ isActive }) =>
        cn(
          base,
          isActive
            ? "border border-accent/30 bg-accent/10 text-[#C7CEFF]"
            : "text-muted hover:bg-surface hover:text-foreground",
        )
      }
    >
      <Icon className="h-[15px] w-[15px] shrink-0" />
      {!collapsed && app.name}
    </NavLink>
  );
}
