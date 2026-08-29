import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultSettings, useSettings, type Settings } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Sadguru Enterprise RO Manager" },
      {
        name: "description",
        content:
          "Configure shop details, reminder lead time and WhatsApp Cloud API credentials for automated customer messaging.",
      },
      { property: "og:title", content: "Settings | Sadguru Enterprise" },
      {
        property: "og:description",
        content: "Shop details, reminder timing and WhatsApp Cloud API configuration.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, save } = useSettings();
  const [draft, setDraft] = useState<Settings>(defaultSettings);

  useEffect(() => setDraft(settings), [settings]);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  return (
    <AppShell
      title="Settings"
      subtitle="Shop details, reminder timing and WhatsApp connection"
      actions={
        <Button
          onClick={() => {
            save(draft);
            toast.success("Settings saved");
          }}
        >
          Save changes
        </Button>
      }
    >
      <div className="grid max-w-4xl gap-4">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Shop</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Shop name</Label>
              <Input value={draft.shopName} onChange={(e) => set({ shopName: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Remind me this many days before a service
              </Label>
              <Input
                type="number"
                min={1}
                value={draft.reminderDays}
                onChange={(e) => set({ reminderDays: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold">WhatsApp Cloud API</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            From Meta for Developers → WhatsApp → API Setup. Stored locally on this device.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Phone number ID</Label>
              <Input
                value={draft.waPhoneNumberId}
                placeholder="1234567890"
                onChange={(e) => set({ waPhoneNumberId: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Access token</Label>
              <Input
                type="password"
                value={draft.waToken}
                placeholder="EAAG..."
                onChange={(e) => set({ waToken: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold">Service reminder template</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Placeholders: {"{name}"}, {"{product}"}, {"{service}"}, {"{date}"}, {"{shop}"}
          </p>
          <Textarea
            rows={4}
            className="mt-3"
            value={draft.waTemplate}
            onChange={(e) => set({ waTemplate: e.target.value })}
          />
        </section>
      </div>
    </AppShell>
  );
}
