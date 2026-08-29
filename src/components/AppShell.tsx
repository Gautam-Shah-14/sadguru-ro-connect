import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Droplets, LayoutDashboard, Users, BellRing, PartyPopper, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reminders", label: "Service Reminders", icon: BellRing },
  { to: "/festivals", label: "Festival Messages", icon: PartyPopper },
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

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-shell text-shell-foreground">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary">
            <Droplets className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Sadguru Enterprise</p>
            <p className="text-[11px] text-shell-muted">RO Sales &amp; Service</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-shell-active font-medium text-shell-foreground"
                    : "text-shell-muted hover:bg-shell-active/60 hover:text-shell-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-5 py-4 text-[11px] text-shell-muted">Offline desktop edition · v1.0</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card/90 px-7 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
