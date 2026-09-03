import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  DatabaseBackup,
  ExternalLink,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, type Settings } from "@/lib/store";
import { api } from "@/lib/api";
import {
  LANGUAGE_LABELS,
  type AIProviderId,
  type HolidayProviderId,
  type MessageLanguage,
} from "../../shared/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const TONES = ["warm", "formal", "playful"] as const;
const CUSTOM = "__custom__";

function SettingsPage() {
  const { settings, saveSettings, loading } = useSettings();
  const [draft, setDraft] = useState<Settings | null>(null);

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  if (loading || !draft) {
    return (
      <AppShell title="Settings" subtitle="Shop details, reminders, AI assistant and WhatsApp">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  return (
    <AppShell
      title="Settings"
      subtitle="Shop details, reminders, AI assistant and WhatsApp"
      actions={
        <Button
          onClick={async () => {
            await saveSettings(draft);
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

        <AIPanel draft={draft} set={set} />

        <HolidayPanel draft={draft} set={set} />

        <WhatsAppPanel draft={draft} set={set} />

        <DataPanel />
      </div>
    </AppShell>
  );
}

function DataPanel() {
  const { data: info } = useQuery({ queryKey: ["app-info"], queryFn: () => api.app.info() });
  const [restoring, setRestoring] = useState(false);

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Data</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your customer database is a single file on this PC
            {info?.dbPath ? ` (${info.dbPath})` : ""}. Restore replaces it and restarts the app.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const res = await api.db.backup();
              if (res.saved) toast.success("Backup saved to " + res.path);
            }}
          >
            <DatabaseBackup className="size-4" /> Backup
          </Button>
          <Button
            variant="outline"
            disabled={restoring}
            onClick={async () => {
              if (
                !confirm("Replace the current database with a backup file? The app will restart.")
              )
                return;
              setRestoring(true);
              try {
                const res = await api.db.restore();
                if (!res.restored && res.error) toast.error(res.error);
              } finally {
                setRestoring(false);
              }
            }}
          >
            {restoring ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}{" "}
            Restore
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Sadguru RO Connect v{info?.version ?? "1.1.0"}
      </p>
    </section>
  );
}

function AIPanel({ draft, set }: { draft: Settings; set: (patch: Partial<Settings>) => void }) {
  const providersQuery = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.ai.providers(),
  });
  const providers = providersQuery.data ?? [];
  const current = providers.find((p) => p.id === draft.aiProvider);

  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const modelIsCustom = useMemo(
    () => !!draft.aiModel && !current?.models.includes(draft.aiModel),
    [draft.aiModel, current],
  );
  const [showCustom, setShowCustom] = useState(modelIsCustom);
  useEffect(() => setShowCustom(modelIsCustom), [modelIsCustom]);

  async function saveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await api.ai.setKey(draft.aiProvider, keyInput.trim());
      setKeyInput("");
      await providersQuery.refetch();
      toast.success(`${current?.label ?? "Provider"} key saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save key");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const model = draft.aiModel || current?.defaultModel;
      const key = keyInput.trim();
      const res = await api.ai.testKey({
        provider: draft.aiProvider,
        ...(model ? { model } : {}),
        ...(key ? { key } : {}),
      });
      if (res.ok) toast.success("Connection OK");
      else toast.error(res.error ?? "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-base font-semibold">AI assistant</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Used to write a custom greeting for each festival. Pick a provider, paste its API key (kept
        encrypted on this PC) and choose a model.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Provider</Label>
          <Select
            value={draft.aiProvider}
            onValueChange={(v) => set({ aiProvider: v as AIProviderId, aiModel: "" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                  {p.keyConfigured ? "  ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <a
              href={current.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Get an API key <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Model</Label>
          <Select
            value={showCustom ? CUSTOM : draft.aiModel || current?.defaultModel || ""}
            onValueChange={(v) => {
              if (v === CUSTOM) {
                setShowCustom(true);
                set({ aiModel: draft.aiModel || "" });
              } else {
                setShowCustom(false);
                set({ aiModel: v });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(current?.models ?? []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                  {m === current?.defaultModel ? "  (default)" : ""}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Custom…</SelectItem>
            </SelectContent>
          </Select>
          {showCustom && (
            <Input
              className="mt-2"
              placeholder="exact model id"
              value={draft.aiModel}
              onChange={(e) => set({ aiModel: e.target.value })}
            />
          )}
        </div>

        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            API key {current?.keyConfigured ? "· saved ✓" : "· not set"}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={current?.keyConfigured ? "Replace saved key…" : "Paste key"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <Button variant="outline" onClick={saveKey} disabled={saving || !keyInput.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Tone</Label>
          <Select
            value={draft.aiTone}
            onValueChange={(v) => set({ aiTone: v as Settings["aiTone"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Festival greeting languages
        </Label>
        <div className="flex gap-4">
          {(Object.keys(LANGUAGE_LABELS) as MessageLanguage[]).map((lng) => {
            const checked = draft.festivalLanguages.includes(lng);
            return (
              <label key={lng} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v
                      ? [...draft.festivalLanguages, lng]
                      : draft.festivalLanguages.filter((x) => x !== lng);
                    set({ festivalLanguages: next.length ? next : ["en"] });
                  }}
                />
                {LANGUAGE_LABELS[lng]}
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="outline" onClick={test} disabled={testing}>
          {testing ? <Loader2 className="size-4 animate-spin" /> : "Test connection"}
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Remember to press “Save changes” to keep the provider / model / tone choice.
        </span>
      </div>
    </section>
  );
}

function WhatsAppPanel({
  draft,
  set,
}: {
  draft: Settings;
  set: (patch: Partial<Settings>) => void;
}) {
  const [token, setToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  async function saveToken() {
    if (!token.trim()) return;
    setSavingToken(true);
    try {
      await api.whatsapp.setToken(token.trim());
      setToken("");
      set({ waTokenConfigured: true });
      toast.success("Access token saved (encrypted)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save token");
    } finally {
      setSavingToken(false);
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setTesting(true);
    try {
      const res = await api.whatsapp.sendTest(testPhone.trim());
      if (res.dryRun) toast.info("Dry-run is on — nothing was sent, only logged.");
      else if (res.ok) toast.success("Test message sent");
      else toast.error(res.error ?? "Send failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" />
        <h2 className="text-base font-semibold">WhatsApp Cloud API</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        From Meta for Developers → WhatsApp → API Setup. The token is encrypted on this PC.
        Business-initiated messages need a Meta-approved template; free-text only reaches numbers
        that messaged you in the last 24 hours (and test numbers).
      </p>

      <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
        <div>
          <Label htmlFor="dry" className="text-sm">
            Dry-run (log messages, don&apos;t actually send)
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Keep this on until you have tested with a real number.
          </p>
        </div>
        <Switch id="dry" checked={draft.waDryRun} onCheckedChange={(v) => set({ waDryRun: v })} />
      </div>

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
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Access token {draft.waTokenConfigured ? "· saved ✓" : "· not set"}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={token}
              placeholder={draft.waTokenConfigured ? "Replace saved token…" : "EAAG…"}
              onChange={(e) => setToken(e.target.value)}
            />
            <Button variant="outline" onClick={saveToken} disabled={savingToken || !token.trim()}>
              {savingToken ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Approved template name (optional)
          </Label>
          <Input
            value={draft.waTemplateName}
            placeholder="e.g. service_reminder"
            onChange={(e) => set({ waTemplateName: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Template language code
          </Label>
          <Input
            value={draft.waLanguageCode}
            placeholder="en"
            onChange={(e) => set({ waLanguageCode: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-4">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          Service reminder message · placeholders {"{name}"} {"{product}"} {"{service}"} {"{date}"}{" "}
          {"{shop}"}
        </Label>
        <Textarea
          rows={3}
          value={draft.waTemplate}
          onChange={(e) => set({ waTemplate: e.target.value })}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Input
          value={testPhone}
          placeholder="Test number, e.g. 9825012345"
          className="max-w-xs"
          onChange={(e) => setTestPhone(e.target.value)}
        />
        <Button variant="outline" onClick={sendTest} disabled={testing || !testPhone.trim()}>
          {testing ? <Loader2 className="size-4 animate-spin" /> : "Send test message"}
        </Button>
      </div>
    </section>
  );
}

function HolidayPanel({
  draft,
  set,
}: {
  draft: Settings;
  set: (patch: Partial<Settings>) => void;
}) {
  const q = useQuery({ queryKey: ["holiday-providers"], queryFn: () => api.holidays.providers() });
  const providers = q.data ?? [];
  const current = providers.find((p) => p.id === draft.holidayProvider);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function saveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await api.holidays.setKey(draft.holidayProvider, keyInput.trim());
      setKeyInput("");
      await q.refetch();
      toast.success("Holiday API key saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save key");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await api.holidays.testKey({
        provider: draft.holidayProvider,
        ...(keyInput.trim() ? { key: keyInput.trim() } : {}),
      });
      if (res.ok) toast.success("Holiday API OK");
      else toast.error(res.error ?? "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-primary" />
        <h2 className="text-base font-semibold">Festival calendar sync</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Lunar festivals (Diwali, Holi, Raksha Bandhan…) fall on different dates each year. Add a
        free holiday API key here, then use <b>Sync dates</b> on the Festival Messages page to fill
        each year automatically. You can always edit dates by hand instead.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Provider</Label>
          <Select
            value={draft.holidayProvider}
            onValueChange={(v) => set({ holidayProvider: v as HolidayProviderId })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                  {p.keyConfigured ? "  ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <>
              <a
                href={current.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Get an API key <ExternalLink className="size-3" />
              </a>
              <p className="mt-1 text-[11px] text-muted-foreground">{current.note}</p>
            </>
          )}
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            API key {current?.keyConfigured ? "· saved ✓" : "· not set"}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder={current?.keyConfigured ? "Replace saved key…" : "Paste key"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <Button variant="outline" onClick={saveKey} disabled={saving || !keyInput.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </div>
          <Button variant="outline" className="mt-2" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : "Test"}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
        <div>
          <Label htmlFor="autosync" className="text-sm">
            Keep festival dates updated automatically
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Once a day, refresh this year and next year's dates (and add new festivals) from the
            calendar. Needs a key above.
          </p>
        </div>
        <Switch
          id="autosync"
          checked={draft.autoSyncFestivals}
          onCheckedChange={(v) => set({ autoSyncFestivals: v })}
        />
      </div>
    </section>
  );
}
