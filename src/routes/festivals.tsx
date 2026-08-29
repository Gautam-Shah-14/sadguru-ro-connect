import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  daysUntil,
  FESTIVALS,
  fillTemplate,
  formatIN,
  nextOccurrence,
  useCustomers,
  useSettings,
} from "@/lib/store";

export const Route = createFileRoute("/festivals")({
  head: () => ({
    meta: [
      { title: "Festival Messaging | Sadguru Enterprise RO Manager" },
      {
        name: "description",
        content:
          "Automated WhatsApp greetings for Diwali, Holi, Raksha Bandhan and every Indian festival, sent to all Sadguru Enterprise customers.",
      },
      { property: "og:title", content: "Festival Messaging | Sadguru Enterprise" },
      {
        property: "og:description",
        content: "Schedule automatic festival greetings for every RO customer.",
      },
    ],
  }),
  component: FestivalsPage,
});

function FestivalsPage() {
  const { customers } = useCustomers();
  const { settings, save } = useSettings();
  const [template, setTemplate] = useState<string | null>(null);
  const tpl = template ?? settings.festivalTemplate;

  const list = FESTIVALS.map((f) => ({ ...f, next: nextOccurrence(f.date) })).sort((a, b) =>
    a.next.localeCompare(b.next),
  );

  return (
    <AppShell
      title="Festival Messaging"
      subtitle={`Automatic greetings to ${customers.length} customers on every Indian festival`}
    >
      <div className="grid grid-cols-3 gap-4">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Greeting template</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Use {"{name}"}, {"{festival}"} and {"{shop}"} as placeholders.
          </p>
          <Textarea
            rows={6}
            className="mt-3"
            value={tpl}
            onChange={(e) => setTemplate(e.target.value)}
          />
          <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
            <Label htmlFor="auto" className="text-sm">
              Send automatically at 9:00 AM
            </Label>
            <Switch
              id="auto"
              checked={settings.autoFestival}
              onCheckedChange={(v) => save({ ...settings, autoFestival: v })}
            />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              save({ ...settings, festivalTemplate: tpl });
              toast.success("Festival template saved");
            }}
          >
            Save template
          </Button>
          <div className="mt-4 rounded-md bg-accent/60 p-3 text-xs text-accent-foreground">
            Preview: {fillTemplate(tpl, { name: "Ramesh", festival: "Diwali", shop: settings.shopName })}
          </div>
        </section>

        <section className="panel col-span-2 p-5">
          <h2 className="mb-3 text-base font-semibold">Festival calendar</h2>
          <ul className="divide-y divide-border">
            {list.map((f) => {
              const d = daysUntil(f.next);
              return (
                <li key={f.name} className="flex items-center gap-3 py-3">
                  <span className="text-xl">{f.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatIN(f.next)}</p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {d === 0 ? "Today" : `in ${d} days`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      settings.autoFestival
                        ? "bg-success/15 text-success"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {settings.autoFestival ? "Scheduled" : "Manual"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.success(`${f.name} greeting queued for ${customers.length} customers`)
                    }
                  >
                    <Send className="size-4" /> Send now
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
