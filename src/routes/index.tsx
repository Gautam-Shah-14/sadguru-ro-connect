import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, IndianRupee, PartyPopper, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  daysUntil,
  formatIN,
  nextOccurrence,
  serviceDates,
  SERVICE_LABELS,
  useCustomers,
  useDueList,
  useFestivals,
  useSettings,
} from "@/lib/store";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const { customers } = useCustomers();
  const { dueList } = useDueList();
  const { festivals } = useFestivals(new Date().getFullYear());
  const { settings } = useSettings();

  const reminderDays = settings?.reminderDays ?? 15;
  const overdue = dueList.filter((d) => d.status === "overdue");
  const soon = dueList.filter((d) => d.status === "due-soon");
  const revenue = customers.reduce((sum, c) => sum + (c.amount || 0), 0);

  const upcomingFestivals = festivals
    .filter((f) => f.active)
    .map((f) => ({ ...f, next: nextOccurrence(f.month, f.day) }))
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 5);

  const chartData = monthlyServiceLoad(customers);

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
                No services due in the next {reminderDays} days.
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
              <li key={f.id} className="flex items-center gap-3">
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
            {!upcomingFestivals.length && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No festivals configured.
              </li>
            )}
          </ul>
          <Button variant="outline" className="mt-4 w-full" asChild>
            <Link to="/festivals">Festival messaging</Link>
          </Button>
        </section>
      </div>

      <section className="panel mt-4 p-5">
        <h2 className="mb-4 text-base font-semibold">Service load — next 6 months</h2>
        {chartData.some((d) => d.count > 0) ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Add customers to see the upcoming service workload.
          </p>
        )}
      </section>
    </AppShell>
  );
}

function monthlyServiceLoad(customers: { sellingDate: string }[]) {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);

  const buckets: { key: string; label: string; count: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "short" }),
      count: 0,
    });
  }

  for (const c of customers) {
    const dates = serviceDates(c);
    for (const iso of Object.values(dates)) {
      const bucket = buckets.find((b) => iso.startsWith(b.key));
      if (bucket) bucket.count += 1;
    }
  }
  return buckets;
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
    <div className="panel panel-hover p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent/60">
          <Icon className={`size-4 ${tone ?? "text-primary"}`} />
        </span>
      </div>
      <p className={`mt-2 font-display text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
