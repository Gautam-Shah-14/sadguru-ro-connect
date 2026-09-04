import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { Festival, FestivalDateSource } from "../../shared/types";

type Row = {
  id: string;
  name: string;
  month: number;
  day: number;
  emoji: string;
  active: number;
  sort: number;
};

const toFestival = (r: Row): Festival => ({
  id: r.id,
  name: r.name,
  month: r.month,
  day: r.day,
  emoji: r.emoji,
  active: !!r.active,
  sort: r.sort,
});

export function listFestivals(): Festival[] {
  const rows = getDb()
    .prepare("SELECT * FROM festivals ORDER BY sort ASC, month ASC, day ASC")
    .all() as Row[];
  return rows.map(toFestival);
}

export function upsertFestival(f: Partial<Festival>): Festival {
  const id = f.id || randomUUID();
  const existing = f.id
    ? (getDb().prepare("SELECT * FROM festivals WHERE id = ?").get(f.id) as Row | undefined)
    : undefined;

  const merged = {
    id,
    name: f.name ?? existing?.name ?? "Untitled festival",
    month: f.month ?? existing?.month ?? 1,
    day: f.day ?? existing?.day ?? 1,
    emoji: f.emoji ?? existing?.emoji ?? "🎉",
    active: (f.active ?? (existing ? !!existing.active : true)) ? 1 : 0,
    sort: f.sort ?? existing?.sort ?? 999,
  };

  getDb()
    .prepare(
      `INSERT INTO festivals (id, name, month, day, emoji, active, sort)
       VALUES (@id, @name, @month, @day, @emoji, @active, @sort)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, month=excluded.month, day=excluded.day,
         emoji=excluded.emoji, active=excluded.active, sort=excluded.sort`,
    )
    .run(merged);

  return toFestival(getDb().prepare("SELECT * FROM festivals WHERE id = ?").get(id) as Row);
}

export function removeFestival(id: string): void {
  getDb().prepare("DELETE FROM festivals WHERE id = ?").run(id);
}

export function getFestival(id: string): Festival | null {
  const row = getDb().prepare("SELECT * FROM festivals WHERE id = ?").get(id) as Row | undefined;
  return row ? toFestival(row) : null;
}

/* ---------------- per-year dates (lunar festivals shift each year) ---------------- */

type DateRow = { festival_id: string; month: number; day: number; source: FestivalDateSource };

/** Festivals with month/day resolved to the given year's override when one exists. */
export function listFestivalsForYear(year: number): Festival[] {
  const overrides = new Map<string, DateRow>();
  for (const d of getDb()
    .prepare("SELECT festival_id, month, day, source FROM festival_dates WHERE year = ?")
    .all(year) as DateRow[]) {
    overrides.set(d.festival_id, d);
  }
  return listFestivals().map((f) => {
    const o = overrides.get(f.id);
    return o
      ? { ...f, month: o.month, day: o.day, dateSource: o.source }
      : { ...f, dateSource: "default" as FestivalDateSource };
  });
}

export function getFestivalForYear(id: string, year: number): Festival | null {
  const f = getFestival(id);
  if (!f) return null;
  const o = getDb()
    .prepare("SELECT month, day, source FROM festival_dates WHERE festival_id = ? AND year = ?")
    .get(id, year) as { month: number; day: number; source: FestivalDateSource } | undefined;
  return o
    ? { ...f, month: o.month, day: o.day, dateSource: o.source }
    : { ...f, dateSource: "default" };
}

export function setFestivalYearDate(
  festivalId: string,
  year: number,
  month: number,
  day: number,
  source: FestivalDateSource = "manual",
): void {
  getDb()
    .prepare(
      `INSERT INTO festival_dates (festival_id, year, month, day, source, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(festival_id, year) DO UPDATE SET
         month=excluded.month, day=excluded.day, source=excluded.source, updated_at=datetime('now')`,
    )
    .run(festivalId, year, month, day, source);
}

export function clearFestivalYearDate(festivalId: string, year: number): void {
  getDb()
    .prepare("DELETE FROM festival_dates WHERE festival_id = ? AND year = ?")
    .run(festivalId, year);
}
