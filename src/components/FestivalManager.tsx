import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useFestivals, formatIN } from "@/lib/store";
import { api } from "@/lib/api";
import type { FestivalSyncPreview, HolidayProviderId } from "../../shared/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------- manage festivals ------------------------------- */

export function FestivalManagerDialog({
  open,
  onOpenChange,
  year,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
}) {
  const { festivals, upsertFestival, removeFestival, setFestivalYearDate } = useFestivals(year);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎉");

  async function add() {
    if (!newName.trim()) return;
    await upsertFestival({
      name: newName.trim(),
      emoji: newEmoji.trim() || "🎉",
      month: 1,
      day: 1,
      active: true,
    });
    setNewName("");
    setNewEmoji("🎉");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage festivals</DialogTitle>
          <DialogDescription>
            Add, rename or remove festivals, and set the exact date for {year}. Lunar festivals move
            every year — use “Sync dates” to fill them from the holiday calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Icon</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Date in {year}</th>
                <th className="pb-2 font-medium">On</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {festivals.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="py-1.5 pr-2">
                    <Input
                      defaultValue={f.emoji}
                      className="h-8 w-12 text-center"
                      onBlur={(e) =>
                        e.target.value !== f.emoji &&
                        upsertFestival({ id: f.id, emoji: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      defaultValue={f.name}
                      className="h-8"
                      onBlur={(e) =>
                        e.target.value.trim() &&
                        e.target.value !== f.name &&
                        upsertFestival({ id: f.id, name: e.target.value.trim() })
                      }
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1">
                      <select
                        value={f.month}
                        className="h-8 rounded-md border border-input bg-background px-1 text-sm"
                        onChange={(e) =>
                          setFestivalYearDate({
                            festivalId: f.id,
                            year,
                            month: Number(e.target.value),
                            day: f.day,
                          })
                        }
                      >
                        {MONTHS.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={f.day}
                        className="h-8 w-16"
                        onBlur={(e) => {
                          const day = Math.min(31, Math.max(1, Number(e.target.value) || 1));
                          if (day !== f.day)
                            setFestivalYearDate({ festivalId: f.id, year, month: f.month, day });
                        }}
                      />
                      {f.dateSource && f.dateSource !== "default" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {f.dateSource === "manual" ? "set" : f.dateSource}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Switch
                      checked={f.active}
                      onCheckedChange={(v) => upsertFestival({ id: f.id, active: v })}
                    />
                  </td>
                  <td className="py-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (confirm(`Delete “${f.name}”?`)) await removeFestival(f.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="!justify-between">
          <div className="flex items-center gap-2">
            <Input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="h-9 w-12 text-center"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New festival name"
              className="h-9 w-56"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button variant="outline" onClick={add} disabled={!newName.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- sync from holiday API ------------------------------- */

export function FestivalSyncDialog({
  open,
  onOpenChange,
  year,
  provider,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  provider: HolidayProviderId;
  onApplied: () => void;
}) {
  const preview = useQuery({
    queryKey: ["holiday-preview", year],
    queryFn: () => api.holidays.preview({ year }),
    enabled: open,
    retry: false,
  });

  const data = preview.data as FestivalSyncPreview | undefined;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [addNew, setAddNew] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (data) {
      const init: Record<string, boolean> = {};
      for (const m of data.matches) init[m.festivalId] = m.changed;
      setChecked(init);
      setAddNew(data.unmatchedHolidays.length > 0);
    }
  }, [data]);

  const selectedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const newCount = addNew ? (data?.unmatchedHolidays.length ?? 0) : 0;

  async function apply() {
    if (!data) return;
    setApplying(true);
    try {
      const updates = data.matches
        .filter((m) => checked[m.festivalId])
        .map((m) => ({ festivalId: m.festivalId, iso: m.newIso }));
      const additions = addNew ? data.unmatchedHolidays : [];
      const r = await api.holidays.apply({ year, updates, additions, provider });
      toast.success(
        `${year}: ${r.updated} date${r.updated === 1 ? "" : "s"} updated` +
          (r.added ? ` · ${r.added} festival${r.added === 1 ? "" : "s"} added` : ""),
      );
      onApplied();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply dates");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sync festival dates for {year}</DialogTitle>
          <DialogDescription>
            Dates fetched from the holiday calendar. Review, then apply the ones you want.
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading && (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Fetching {year} holidays…
          </p>
        )}

        {preview.isError && (
          <div className="panel border-destructive/40 bg-destructive/5 p-4 text-sm">
            {(preview.error as Error)?.message ?? "Could not fetch holidays."}
            <p className="mt-1 text-xs text-muted-foreground">
              Add a holiday API key under Settings → Festival calendar sync.
            </p>
          </div>
        )}

        {data && (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            <ul className="divide-y divide-border">
              {data.matches.map((m) => (
                <li key={m.festivalId} className="flex items-center gap-3 py-2 text-sm">
                  <Checkbox
                    checked={!!checked[m.festivalId]}
                    onCheckedChange={(v) => setChecked((c) => ({ ...c, [m.festivalId]: !!v }))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.festivalName}</p>
                    <p className="text-xs text-muted-foreground">matched “{m.holidayName}”</p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    {m.changed ? (
                      <>
                        <span className="text-muted-foreground line-through">
                          {formatIN(m.currentIso)}
                        </span>
                        <span className="mx-1">→</span>
                        <span className="font-medium text-primary">{formatIN(m.newIso)}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        {formatIN(m.newIso)} (no change)
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {data.unmatchedFestivals.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <b>Not found in the calendar:</b>{" "}
                {data.unmatchedFestivals.map((f) => f.name).join(", ")}. Set these by hand in
                “Manage festivals”.
              </div>
            )}
            {data.unmatchedHolidays.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox checked={addNew} onCheckedChange={(v) => setAddNew(!!v)} />
                  Also add {data.unmatchedHolidays.length} new festival
                  {data.unmatchedHolidays.length === 1 ? "" : "s"} from the calendar
                </label>
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {data.unmatchedHolidays.map((h) => (
                    <li key={h.name + h.iso}>
                      {formatIN(h.iso)} — {h.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={apply}
            disabled={!data || (selectedCount === 0 && newCount === 0) || applying}
          >
            {applying ? <Loader2 className="size-4 animate-spin" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
