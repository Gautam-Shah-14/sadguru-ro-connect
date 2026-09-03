import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarSync, Loader2, RotateCcw, Send, Settings2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FestivalManagerDialog, FestivalSyncDialog } from "@/components/FestivalManager";
import {
  daysUntil,
  fillTemplate,
  formatIN,
  useCustomers,
  useFestivals,
  useSettings,
} from "@/lib/store";
import { api } from "@/lib/api";
import { LANGUAGE_LABELS, type FestivalMessageRow, type MessageLanguage } from "../../shared/types";

export const Route = createFileRoute("/festivals")({ component: FestivalsPage });

const YEARS = [new Date().getFullYear(), new Date().getFullYear() + 1];

function FestivalsPage() {
  const { customers } = useCustomers();
  const { settings, saveSettings } = useSettings();

  const [year, setYear] = useState(YEARS[0]!);
  const [lang, setLang] = useState<MessageLanguage>("en");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const { festivals, refresh: refreshFestivals } = useFestivals(year);
  const holidayProvider = settings?.holidayProvider ?? "calendarific";
  const holidayKeyReady = useQuery({
    queryKey: ["holiday-providers"],
    queryFn: () => api.holidays.providers(),
  }).data?.some((p) => p.id === holidayProvider && p.keyConfigured);

  const languages = useMemo<MessageLanguage[]>(
    () => (settings?.festivalLanguages?.length ? settings.festivalLanguages : ["en"]),
    [settings?.festivalLanguages],
  );
  useEffect(() => {
    if (!languages.includes(lang)) setLang(languages[0] ?? "en");
  }, [languages, lang]);

  const messagesQuery = useQuery({
    queryKey: ["festivalMessages", year],
    queryFn: () => api.festivalMessages.list(year),
  });
  const byKey = useMemo(() => {
    const m = new Map<string, FestivalMessageRow>();
    for (const row of messagesQuery.data ?? []) m.set(`${row.festivalId}:${row.language}`, row);
    return m;
  }, [messagesQuery.data]);

  const missedQuery = useQuery({
    queryKey: ["missed-festivals"],
    queryFn: () => api.whatsapp.missedFestivals(),
  });
  const missed = missedQuery.data ?? [];

  const aiConfigured = !!settings && settings.aiKeyConfigured?.[settings.aiProvider];
  const shopName = settings?.shopName ?? "Sadguru Enterprise";
  const autoFestival = settings?.autoFestival ?? true;

  async function sendMissed(id: string, missedYear: number, festName: string) {
    try {
      const res = await api.whatsapp.sendFestival({
        festivalId: id,
        year: missedYear,
        language: languages[0] ?? "en",
      });
      await Promise.all([missedQuery.refetch(), messagesQuery.refetch()]);
      toast.success(
        `${festName}: ${res.sent} sent · ${res.dryRun} logged (dry-run) · ${res.failed} failed`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  const list = festivals
    .filter((f) => f.active)
    .map((f) => ({
      ...f,
      next: `${year}-${`${f.month}`.padStart(2, "0")}-${`${f.day}`.padStart(2, "0")}`,
    }))
    .sort((a, b) => a.next.localeCompare(b.next));

  async function generateAll() {
    if (!aiConfigured) {
      toast.error("Add an AI provider key in Settings first.");
      return;
    }
    setBulkRunning(true);
    toast.info(`Generating messages for ${year}… this can take a minute.`);
    try {
      const res = await api.festivalMessages.generateAll({ year, languages });
      await messagesQuery.refetch();
      if (res.failed.length) {
        toast.warning(
          `${res.generated} generated, ${res.failed.length} failed. ${res.failed[0]?.error ?? ""}`,
        );
      } else {
        toast.success(`Generated ${res.generated} messages for ${year}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <AppShell
      title="Festival Messaging"
      subtitle={`AI-written greetings for ${customers.length} customers, per festival`}
      actions={
        <>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setManageOpen(true)}>
            <Settings2 className="size-4" /> Manage
          </Button>
          <Button
            variant="outline"
            onClick={() => setSyncOpen(true)}
            disabled={!holidayKeyReady}
            title={holidayKeyReady ? "" : "Add a holiday API key in Settings"}
          >
            <CalendarSync className="size-4" /> Sync dates
          </Button>
          <Button onClick={generateAll} disabled={bulkRunning || !aiConfigured}>
            {bulkRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            Generate all for {year}
          </Button>
        </>
      }
    >
      <FestivalManagerDialog open={manageOpen} onOpenChange={setManageOpen} year={year} />
      <FestivalSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        year={year}
        provider={holidayProvider}
        onApplied={() => {
          void refreshFestivals();
          void messagesQuery.refetch();
        }}
      />
      {!aiConfigured && (
        <div className="panel mb-4 flex items-center gap-3 border-warning/40 bg-warning/10 p-4 text-sm">
          <Sparkles className="size-4 text-warning" />
          <span>
            No AI provider is configured. Add a key under <b>Settings → AI assistant</b> to write
            per-festival messages. Until then the plain template below is used.
          </span>
        </div>
      )}

      {missed.length > 0 && (
        <div className="panel mb-4 border-primary/30 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium">Missed festival greetings</p>
          <ul className="space-y-2">
            {missed.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-sm">
                <span className="text-lg">{m.emoji}</span>
                <span className="flex-1">
                  {m.name} was {m.daysAgo} day{m.daysAgo === 1 ? "" : "s"} ago — no greeting sent.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendMissed(m.id, m.year, m.name)}
                >
                  <Send className="size-4" /> Send now
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">Fallback template</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Used when a festival has no AI message yet. Placeholders: {"{name}"}, {"{festival}"},{" "}
            {"{shop}"}.
          </p>
          <Textarea
            rows={5}
            className="mt-3"
            value={settings?.festivalTemplate ?? ""}
            onChange={(e) => void saveSettings({ festivalTemplate: e.target.value })}
          />
          <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
            <Label htmlFor="auto" className="text-sm">
              Send automatically at 9:00 AM
            </Label>
            <Switch
              id="auto"
              checked={autoFestival}
              onCheckedChange={(v) => void saveSettings({ autoFestival: v })}
            />
          </div>
          <div className="mt-3 rounded-md bg-accent/60 p-3 text-xs text-accent-foreground">
            {fillTemplate(settings?.festivalTemplate ?? "", {
              name: "Ramesh",
              festival: "Diwali",
              shop: shopName,
            })}
          </div>
        </section>

        <section className="panel col-span-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Festival calendar &amp; messages</h2>
            <div className="flex gap-1">
              {(languages as MessageLanguage[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {LANGUAGE_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-3">
            {list.map((f) => (
              <FestivalRow
                key={f.id}
                festivalId={f.id}
                name={f.name}
                emoji={f.emoji}
                next={f.next}
                year={year}
                lang={lang}
                shopName={shopName}
                template={settings?.festivalTemplate ?? ""}
                row={byKey.get(`${f.id}:${lang}`) ?? null}
                aiConfigured={!!aiConfigured}
                customerCount={customers.length}
                onChanged={() => messagesQuery.refetch()}
              />
            ))}
            {!list.length && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                No festivals configured.
              </li>
            )}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function FestivalRow({
  festivalId,
  name,
  emoji,
  next,
  year,
  lang,
  shopName,
  template,
  row,
  aiConfigured,
  customerCount,
  onChanged,
}: {
  festivalId: string;
  name: string;
  emoji: string;
  next: string;
  year: number;
  lang: MessageLanguage;
  shopName: string;
  template: string;
  row: FestivalMessageRow | null;
  aiConfigured: boolean;
  customerCount: number;
  onChanged: () => void;
}) {
  const fallback = fillTemplate(template, { name: "{name}", festival: name, shop: shopName });
  const [draft, setDraft] = useState(row?.body ?? "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "gen" | "save" | "reset" | "send">(null);

  useEffect(() => setDraft(row?.body ?? ""), [row?.body, row?.id]);

  const dirty = draft !== (row?.body ?? "");
  const days = daysUntil(next);

  async function generate() {
    setBusy("gen");
    try {
      const res = await api.festivalMessages.generate({ festivalId, year, language: lang });
      setDraft(res.body);
      onChanged();
      toast.success(`${name} · ${LANGUAGE_LABELS[lang]} written`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      await api.festivalMessages.save({ festivalId, year, language: lang, body: draft });
      onChanged();
      toast.success("Message saved");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    try {
      await api.festivalMessages.reset({ festivalId, year, language: lang });
      setDraft("");
      onChanged();
      toast.success("Reverted to template");
    } finally {
      setBusy(null);
    }
  }

  async function sendNow() {
    if (dirty) {
      toast.error("Save the message before sending.");
      return;
    }
    setBusy("send");
    try {
      const res = await api.whatsapp.sendFestival({ festivalId, year, language: lang });
      onChanged();
      const parts = [
        res.sent && `${res.sent} sent`,
        res.dryRun && `${res.dryRun} logged (dry-run)`,
        res.failed && `${res.failed} failed`,
        res.skipped && `${res.skipped} skipped`,
      ].filter(Boolean);
      toast[res.failed ? "warning" : "success"](
        `${name}: ${parts.join(" · ") || `nothing to send to ${customerCount} customers`}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-lg border border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="text-xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {formatIN(next)} ·{" "}
            {days === 0 ? "today" : days < 0 ? `${-days} days ago` : `in ${days} days`}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            row?.source === "ai"
              ? "bg-primary/15 text-primary"
              : row?.source === "manual"
                ? "bg-success/15 text-success"
                : "bg-secondary text-secondary-foreground"
          }`}
        >
          {row?.source === "ai" ? "AI" : row?.source === "manual" ? "Edited" : "Template"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <Textarea
            rows={4}
            value={draft}
            placeholder={fallback}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {draft.trim().split(/\s+/).filter(Boolean).length} words ·{" "}
            {row?.model ? `via ${row.model}` : "not generated yet"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={!aiConfigured || !!busy}
            >
              {busy === "gen" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {row ? "Regenerate" : "Generate"}
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || !!busy}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={!row || !!busy}>
              <RotateCcw className="size-4" /> Use template
            </Button>
            <Button size="sm" variant="ghost" onClick={sendNow} disabled={!!busy}>
              <Send className="size-4" /> Send now
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
