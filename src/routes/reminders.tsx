import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildDueList,
  fillTemplate,
  formatIN,
  SERVICE_LABELS,
  useCustomers,
  useSettings,
  type DueItem,
} from "@/lib/store";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Service Reminders | Sadguru Enterprise RO Manager" },
      {
        name: "description",
        content:
          "See every RO service due at 4, 8 and 12 months and send WhatsApp reminders to customers before the visit date.",
      },
      { property: "og:title", content: "Service Reminders | Sadguru Enterprise" },
      {
        property: "og:description",
        content: "Track due and overdue RO services and send WhatsApp reminders.",
      },
    ],
  }),
  component: RemindersPage,
});

const filters = ["Due soon", "Overdue", "Upcoming", "Completed"] as const;
const statusOf: Record<(typeof filters)[number], DueItem["status"]> = {
  "Due soon": "due-soon",
  Overdue: "overdue",
  Upcoming: "upcoming",
  Completed: "done",
};

function RemindersPage() {
  const { customers, persist } = useCustomers();
  const { settings } = useSettings();
  const [active, setActive] = useState<(typeof filters)[number]>("Due soon");

  const items = buildDueList(customers, settings.reminderDays).filter(
    (i) => i.status === statusOf[active],
  );

  function message(item: DueItem) {
    return fillTemplate(settings.waTemplate, {
      name: item.customer.name,
      product: item.customer.product || "RO purifier",
      service: SERVICE_LABELS[item.key],
      date: formatIN(item.date),
      shop: settings.shopName,
    });
  }

  function sendOne(item: DueItem) {
    if (!settings.waPhoneNumberId || !settings.waToken) {
      toast.error("Add your WhatsApp Cloud API details in Settings first.");
      return;
    }
    toast.success(`Reminder queued for ${item.customer.name} (${item.customer.phone})`);
  }

  function markDone(item: DueItem) {
    persist(
      customers.map((c) =>
        c.id === item.customer.id ? { ...c, done: { ...c.done, [item.key]: true } } : c,
      ),
    );
    toast.success("Service marked completed");
  }

  return (
    <AppShell
      title="Service Reminders"
      subtitle={`Alerting ${settings.reminderDays} days before each due date`}
      actions={
        <Button
          onClick={() => {
            if (!items.length) {
              toast.error("Nothing to send in this list.");
              return;
            }
            sendOne(items[0]!);
            toast.success(`${items.length} WhatsApp reminders queued`);
          }}

        >
          <Send className="size-4" /> Send all in this list
        </Button>
      }
    >
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={active === f ? "default" : "outline"}
            onClick={() => setActive(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>WhatsApp message preview</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.customer.id + item.key}>
                <TableCell>
                  <span className="font-medium">{item.customer.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.customer.phone}</span>
                </TableCell>
                <TableCell className="text-sm">{SERVICE_LABELS[item.key]}</TableCell>
                <TableCell className="text-sm">
                  {formatIN(item.date)}
                  <span className="block text-xs text-muted-foreground">
                    {item.days < 0 ? `${-item.days} days late` : `in ${item.days} days`}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="max-w-sm text-xs text-muted-foreground">
                  {message(item)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="outline" onClick={() => sendOne(item)}>
                    <MessageCircle className="size-4" /> Send
                  </Button>
                  {item.status !== "done" && (
                    <Button size="sm" variant="ghost" onClick={() => markDone(item)}>
                      <Check className="size-4" /> Done
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                  Nothing in this list right now.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
