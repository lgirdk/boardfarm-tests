import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { V3_APPS, getApp, type V3App } from "./registry";
import { AccountPill } from "./AccountPill";
import { SelectionTray } from "@/modules/runs/SelectionTray";
import { LaunchComposer } from "@/modules/runs/LaunchComposer";
import { TestDetailDrawer } from "@/modules/library/TestDetailDrawer";
import { SettingsHost } from "./SettingsHost";
import { DashboardGreeting } from "@/modules/dashboard/DashboardApp";
import { cn } from "@/lib/cn";

/**
 * V3 shell: launcher (home) ↔ dock (inside an app). No sidebar.
 *
 * HOME state: greeting + 6 large tiles + DashboardApp, all in one scroll.
 * APP state: compact dock (top) + section tier + scrollable body.
 * FLIP animation between the two tile states.
 */
export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Parse URL to determine state ─────────────────────────────────
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentAppId = pathParts[0] ?? null;
  const currentApp = currentAppId ? getApp(currentAppId) : null;
  const isHome = !currentApp;

  // Is this a "detail" sub-route? (e.g. /runs/r-0144, /pipelines/ticket-to-tested)
  // Detail routes have a second path segment that is NOT a known section id.
  const subPath = pathParts[1] ?? "";
  const isKnownSection = currentApp?.sections.some((s) => s.id === subPath) ?? false;
  const isDetailRoute = !isHome && subPath !== "" && !isKnownSection;

  // Current section for the tier highlight
  const currentSection = isDetailRoute
    ? currentApp?.sections[0]
    : (currentApp?.sections.find((s) => {
        if (s === currentApp?.sections[0] && subPath === "") return true;
        return s.id === subPath;
      }) ?? currentApp?.sections[0]);

  // ── FLIP animation ─────────────────────────────────────────────────
  const tilesRef = useRef<HTMLDivElement>(null);
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  const captureRects = useCallback(() => {
    if (!tilesRef.current) return;
    const map = new Map<string, DOMRect>();
    tilesRef.current
      .querySelectorAll<HTMLElement>("[data-tile]")
      .forEach((el) => {
        const k = el.dataset.tile;
        if (k) map.set(k, el.getBoundingClientRect());
      });
    prevRects.current = map;
  }, []);

  const animateFlip = useCallback(() => {
    if (!tilesRef.current) return;
    tilesRef.current
      .querySelectorAll<HTMLElement>("[data-tile]")
      .forEach((el) => {
        const k = el.dataset.tile;
        if (!k) return;
        const first = prevRects.current.get(k);
        if (!first) return;
        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        const sx = first.width / last.width;
        const sy = first.height / last.height;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01)
          return;
        el.animate(
          [
            {
              transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`,
              opacity: 0.85,
            },
            { transform: "none", opacity: 1 },
          ],
          { duration: 520, easing: "cubic-bezier(.22,.72,.24,1)" },
        );
      });
  }, []);

  const prevIsHome = useRef(isHome);
  useEffect(() => {
    if (prevIsHome.current !== isHome) {
      animateFlip();
      prevIsHome.current = isHome;
    }
  }, [isHome, animateFlip]);

  // ── Navigation helpers ─────────────────────────────────────────────
  function openApp(appId: string, sectionId?: string) {
    captureRects();
    const app = getApp(appId);
    if (!app) return;
    const sec = sectionId
      ? app.sections.find((s) => s.id === sectionId)
      : app.sections[0];
    const secPath = sec && sec !== app.sections[0] ? `/${sec.id}` : "";
    navigate(`/${appId}${secPath}`);
  }

  function goHome() {
    captureRects();
    navigate("/");
  }

  function switchSection(sectionId: string) {
    if (!currentApp) return;
    const sec = currentApp.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const secPath = sec !== currentApp.sections[0] ? `/${sec.id}` : "";
    navigate(`/${currentApp.id}${secPath}`);
  }

  function goBackToList() {
    if (!currentApp) return;
    navigate(`/${currentApp.id}`);
  }

  // Escape: close drawer first, then go home
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isHome) goHome();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome]);

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Account pill — fixed top-right, always visible */}
      <AccountPill onOpenSettings={() => setSettingsOpen(true)} />

      {isHome ? (
        /* ════ HOME: greeting → tiles → dashboard body, all in one scroll ════ */
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DashboardGreeting />
          <div
            ref={tilesRef}
            className="mx-auto grid w-full max-w-[900px] grid-cols-3 gap-[18px] px-[30px] pt-[24px] pb-[30px]"
          >
            {V3_APPS.map((app) => (
              <TileButton
                key={app.id}
                app={app}
                isLauncher
                isActive={false}
                onOpenApp={openApp}
              />
            ))}
          </div>
          {/* DashboardApp renders here via <Outlet /> */}
          <Outlet />
          {/* Selection tray at bottom of home too */}
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
            <SelectionTray />
          </div>
        </div>
      ) : (
        /* ════ APP MODE: dock + tier + body ════ */
        <>
          {/* Dock */}
          <div
            ref={tilesRef}
            className="flex flex-none items-center justify-center gap-2 border-b border-border px-5 py-[14px] backdrop-blur-[14px]"
            style={{ background: `linear-gradient(180deg, var(--glass-dock-from), var(--glass-dock-to))` }}
          >
            {V3_APPS.map((app) => (
              <TileButton
                key={app.id}
                app={app}
                isLauncher={false}
                isActive={currentAppId === app.id}
                onOpenApp={openApp}
              />
            ))}
          </div>

          {/* Section tier */}
          <div className="flex flex-none items-center gap-[6px] overflow-x-auto border-b border-border bg-gradient-to-b from-[rgb(var(--glass)/0.014)] to-transparent px-[34px] py-[11px]">
            <button
              onClick={goHome}
              title="All apps"
              className="flex items-center rounded-[10px] px-[14px] py-[7px] text-muted transition-colors duration-[160ms] hover:bg-[rgb(var(--glass)/var(--glass-hover))] hover:text-foreground"
            >
              <Home className="h-[15px] w-[15px]" />
            </button>
            <div className="mx-2 h-5 w-px bg-border" />

            {/* Back button when on a detail route (e.g. /runs/:id) */}
            {isDetailRoute && (
              <>
                <button
                  onClick={goBackToList}
                  className="flex items-center gap-[6px] rounded-[10px] px-[14px] py-[7px] text-[13px] text-muted transition-colors duration-[160ms] hover:bg-[rgb(var(--glass)/var(--glass-hover))] hover:text-foreground"
                >
                  <ArrowLeft className="h-[14px] w-[14px]" />
                  Back
                </button>
                <div className="mx-1 h-5 w-px bg-border" />
              </>
            )}

            {currentApp?.sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => switchSection(sec.id)}
                  className={cn(
                    "flex items-center gap-[8px] whitespace-nowrap rounded-[10px] px-[14px] py-[7px] text-[13px] transition-colors duration-[160ms]",
                    currentSection?.id === sec.id
                      ? "border border-border-strong bg-surface-raised text-foreground"
                      : "border border-transparent text-muted hover:bg-[rgb(var(--glass)/var(--glass-hover))] hover:text-foreground",
                  )}
                >
                  {Icon && <Icon className="h-[15px] w-[15px]" />}
                  {sec.label}
                  {sec.count && (
                    <span className="font-mono text-[11px] text-faint">
                      {sec.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Body — min-h-0 is critical: without it, flex-1 children in a
               flex-col won't shrink below content height, killing scroll. */}
          <div className="relative min-h-0 flex-1">
            <main className="absolute inset-0 overflow-y-auto">
              <Outlet />
            </main>
            <SelectionTray />
          </div>
        </>
      )}

      {/* ── Always-on overlays ────────────────────────────────── */}
      <SettingsHost open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TestDetailDrawer />
      <LaunchComposer />
    </div>
  );
}

/* ── TileButton ───────────────────────────────────────────────────── */
function TileButton({
  app,
  isLauncher,
  isActive,
  onOpenApp,
}: {
  app: V3App;
  isLauncher: boolean;
  isActive: boolean;
  onOpenApp: (appId: string, sectionId?: string) => void;
}) {
  const Icon = app.icon;

  if (isLauncher) {
    return (
      <button
        data-tile={app.id}
        onClick={() => onOpenApp(app.id)}
        className="v3-card group relative flex min-h-[260px] flex-col overflow-hidden p-[22px] text-left transition-all duration-200 hover:-translate-y-1 hover:border-border-strong"
        style={{ borderRadius: "var(--r-tile, 22px)" }}
      >
        <div
          className="pointer-events-none absolute -right-[35%] -top-[45%] h-[210px] w-[210px] rounded-full opacity-30 blur-[52px] transition-opacity duration-[250ms] group-hover:opacity-[.55]"
          style={{ background: `rgb(${app.color})` }}
        />
        {app.count && (
          <div
            className="absolute right-6 top-6 font-display text-[25px] font-semibold tracking-tight opacity-90"
            style={{ color: `rgb(${app.color})` }}
          >
            {app.count}
          </div>
        )}
        <div
          className="mb-[15px] grid h-[44px] w-[44px] place-items-center rounded-[14px] border transition-all duration-300"
          style={{
            color: `rgb(${app.color})`,
            background: `rgba(${app.color},.12)`,
            borderColor: `rgba(${app.color},.25)`,
          }}
        >
          <Icon className="h-[22px] w-[22px]" />
        </div>
        <div className="font-display text-[19px] font-semibold tracking-tight">
          {app.name}
        </div>
        <div className="mt-[6px] text-[12.5px] leading-[1.5] text-muted">
          {app.sub}
        </div>
        <div className="mt-3 flex flex-wrap gap-[5px]">
          {app.sections.map((sec) => (
            <span
              key={sec.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenApp(app.id, sec.id);
              }}
              className="cursor-pointer rounded-[7px] border border-border bg-[rgb(var(--glass)/0.022)] px-[9px] py-[3px] text-[11px] text-muted transition-all duration-[140ms] hover:border-border-strong hover:bg-[rgb(var(--glass)/0.07)] hover:text-foreground"
            >
              {sec.label}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-[13px] text-[11.5px] text-faint">
          {app.foot}
        </div>
      </button>
    );
  }

  // Dock mode
  return (
    <button
      data-tile={app.id}
      onClick={() => onOpenApp(app.id)}
      className={cn(
        "flex items-center gap-[10px] rounded-[13px] border px-[15px] py-[9px] pl-[11px] transition-all duration-[160ms]",
        isActive
          ? "border-accent/50 bg-gradient-to-b from-accent/[.16] to-accent/[.05]"
          : "border-border hover:border-border-strong hover:bg-surface-raised",
      )}
    >
      <div
        className="grid h-[26px] w-[26px] place-items-center rounded-[8px]"
        style={{ color: `rgb(${app.color})` }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[13.5px] font-medium">{app.name}</span>
    </button>
  );
}
