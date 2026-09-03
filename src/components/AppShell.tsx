import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  BellRing,
  Droplets,
  LayoutDashboard,
  Moon,
  PartyPopper,
  ScrollText,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getStoredTheme, applyTheme } from "@/lib/theme";
import { useSettings } from "@/lib/store";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reminders", label: "Service Reminders", icon: BellRing },
  { to: "/festivals", label: "Festival Messages", icon: PartyPopper },
  { to: "/activity", label: "Activity", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { settings, saveSettings } = useSettings();
  const { data: info } = useQuery({ queryKey: ["app-info"], queryFn: () => api.app.info() });

  const theme = settings?.theme ?? getStoredTheme();

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    void saveSettings({ theme: next });
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Custom window title bar — draggable; native min/max/close overlay sits at the right. */}
      <div
        className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card pl-4 pr-[150px] text-xs text-muted-foreground"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <Droplets className="size-3.5 text-primary" />
        <span className="font-medium text-foreground">Sadguru RO Connect</span>
        <span className="text-muted-foreground">— {title}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col bg-shell text-shell-foreground [background-image:linear-gradient(180deg,var(--shell-accent),var(--shell)_46%)]">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-inner">
              <Droplets className="size-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">Sadguru Enterprise</p>
              <p className="text-[11px] text-shell-muted">RO Sales &amp; Service</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-shell-active font-medium text-shell-foreground shadow-sm"
                      : "text-shell-muted hover:bg-shell-active/50 hover:text-shell-foreground",
                  )}
                >
                  <item.icon className={cn("size-4 transition-transform", active && "scale-110")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-5 py-4 text-[11px] text-shell-muted">
            Offline desktop edition · v{info?.version ?? "1.1.0"}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card/85 px-7 py-4 backdrop-blur">
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
                className="inline-flex size-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
