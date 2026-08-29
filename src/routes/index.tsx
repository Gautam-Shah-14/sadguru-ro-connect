import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, IndianRupee, PartyPopper, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  buildDueList,
  daysUntil,
  FESTIVALS,
  formatIN,
  nextOccurrence,
  SERVICE_LABELS,
  useCustomers,
  useSettings,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sadguru Enterprise | RO Sales & Service Manager" },
      {
        name: "description",
        content:
          "Desktop dashboard for Sadguru Enterprise: track RO customers, automatic 4/8/12-month service reminders and WhatsApp festival greetings.",
      },
      { property: "og:title", content: "Sadguru Enterprise RO Manager" },
      {
        property: "og:description",
        content: "Track RO customers, service due dates and automated WhatsApp messaging.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const due = buildDueList(customers, settings.reminderDays);
  const overdue = due.filter((d) => d.status === "overdue");
  const soon = due.filter((d) => d.status === "due-soon");
  const revenue = customers.reduce((sum, c) => sum + (c.amount || 0), 0);
  const upcomingFestivals = FESTIVALS.map((f) => ({ ...f, next: nextOccurrence(f.date) }))
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 4);

  return (
    <AppShell
      title="Dashboard"
      subtitle="Today's overview of sales, servicing and messaging"
      actions={
        <Button asChild>
          <Link to="/customers">Open customer records</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-4 gap-4">
        <Stat icon={Users} label="Total customers" value={String(customers.length)} />
        <Stat
          icon={BellRing}
          label="Services due soon"
          value={String(soon.length)}
          tone="text-warning"
        />
        <Stat
          icon={BellRing}
          label="Overdue services"
          value={String(overdue.length)}
          tone="text-destructive"
        />
        <Stat
          icon={IndianRupee}
          label="Total sales value"
          value={`₹${revenue.toLocaleString("en-IN")}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <section className="panel col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Next service visits</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reminders">View all</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {[...overdue, ...soon].slice(0, 6).map((item) => (
              <li key={item.customer.id + item.key} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {SERVICE_LABELS[item.key]} · {formatIN(item.date)}
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {item.days < 0 ? `${-item.days} days late` : `in ${item.days} days`}
                </span>
                <StatusBadge status={item.status} />
              </li>
            ))}
            {![...overdue, ...soon].length && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                No services due in the next {settings.reminderDays} days.
              </li>
            )}
          </ul>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <PartyPopper className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Upcoming festivals</h2>
          </div>
          <ul className="space-y-3">
            {upcomingFestivals.map((f) => (
              <li key={f.name} className="flex items-center gap-3">
                <span className="text-xl">{f.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatIN(f.next)}</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {daysUntil(f.next)}d
                </span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/festivals">Festival messaging</Link>
          </Button>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${tone ?? "text-primary"}`} />
      </div>
      <p className={`mt-2 font-display text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
