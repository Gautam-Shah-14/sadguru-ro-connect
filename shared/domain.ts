// Pure domain logic shared by the Electron main process and the renderer.
// No DOM, no Node, no Electron imports here.

import type { Customer, DueItem, DueStatus, Festival, ServiceKey } from "./types";

export const SERVICE_OFFSETS: Record<ServiceKey, number> = {
  service1: 4,
  service2: 8,
  service3: 12,
};

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  service1: "1st Service (4 months)",
  service2: "2nd Service (8 months)",
  service3: "3rd Service (12 months)",
};

export const SERVICE_KEYS: ServiceKey[] = ["service1", "service2", "service3"];

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return toISO(d);
}

export function formatIN(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function serviceDates(c: Pick<Customer, "sellingDate">): Record<ServiceKey, string> {
  return {
    service1: addMonths(c.sellingDate, SERVICE_OFFSETS.service1),
    service2: addMonths(c.sellingDate, SERVICE_OFFSETS.service2),
    service3: addMonths(c.sellingDate, SERVICE_OFFSETS.service3),
  };
}

export function buildDueList(customers: Customer[], reminderDays: number): DueItem[] {
  const items: DueItem[] = [];
  for (const c of customers) {
    const dates = serviceDates(c);
    for (const key of SERVICE_KEYS) {
      const date = dates[key];
      if (!date) continue;
      const days = daysUntil(date);
      const status: DueStatus = c.done[key]
        ? "done"
        : days < 0
          ? "overdue"
          : days <= reminderDays
            ? "due-soon"
            : "upcoming";
      items.push({ customer: c, key, date, days, status });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/** Normalise an Indian phone number to plain international digits, or null if unusable. */
export function normalizePhone(raw: string, defaultCc = "91"): string | null {
  let d = (raw || "").replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = defaultCc + d;
  else if (d.length === 11 && d.startsWith("0")) d = defaultCc + d.slice(1);
  if (d.length < 11 || d.length > 15) return null;
  return d;
}

/** Next calendar occurrence of a month/day, rolling to next year once it has passed. */
export function nextOccurrence(month: number, day: number): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const mm = `${month}`.padStart(2, "0");
  const dd = `${day}`.padStart(2, "0");
  const thisYear = `${now.getFullYear()}-${mm}-${dd}`;
  return daysUntil(thisYear) >= 0 ? thisYear : `${now.getFullYear() + 1}-${mm}-${dd}`;
}

export type SeedFestival = Omit<Festival, "id" | "active" | "sort">;

// Indian festival calendar (dates approximate for planning; editable per year in-app).
export const FESTIVALS_SEED: SeedFestival[] = [
  { name: "Makar Sankranti", month: 1, day: 14, emoji: "🪁" },
  { name: "Republic Day", month: 1, day: 26, emoji: "🇮🇳" },
  { name: "Maha Shivratri", month: 2, day: 15, emoji: "🔱" },
  { name: "Holi", month: 3, day: 4, emoji: "🎨" },
  { name: "Gudi Padwa / Ugadi", month: 3, day: 19, emoji: "🌿" },
  { name: "Ram Navami", month: 3, day: 27, emoji: "🏹" },
  { name: "Akshaya Tritiya", month: 4, day: 29, emoji: "✨" },
  { name: "Independence Day", month: 8, day: 15, emoji: "🇮🇳" },
  { name: "Raksha Bandhan", month: 8, day: 28, emoji: "🧵" },
  { name: "Janmashtami", month: 9, day: 4, emoji: "🪈" },
  { name: "Ganesh Chaturthi", month: 9, day: 14, emoji: "🐘" },
  { name: "Navratri", month: 10, day: 11, emoji: "🪔" },
  { name: "Dussehra", month: 10, day: 20, emoji: "🏹" },
  { name: "Dhanteras", month: 11, day: 7, emoji: "🪙" },
  { name: "Diwali", month: 11, day: 9, emoji: "🪔" },
  { name: "Bhai Dooj", month: 11, day: 12, emoji: "🎁" },
  { name: "Christmas", month: 12, day: 25, emoji: "🎄" },
  { name: "New Year", month: 12, day: 31, emoji: "🎉" },
];
