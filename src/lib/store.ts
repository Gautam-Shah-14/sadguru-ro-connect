import { useCallback, useEffect, useState } from "react";

export type ServiceKey = "service1" | "service2" | "service3";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  product: string;
  serialNo: string;
  sellingDate: string; // yyyy-MM-dd
  amount: number;
  notes: string;
  done: Record<ServiceKey, boolean>;
};

export type Settings = {
  shopName: string;
  reminderDays: number;
  waPhoneNumberId: string;
  waToken: string;
  waTemplate: string;
  festivalTemplate: string;
  autoFestival: boolean;
};

const CUSTOMERS_KEY = "sadguru.customers.v1";
const SETTINGS_KEY = "sadguru.settings.v1";

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

export const defaultSettings: Settings = {
  shopName: "Sadguru Enterprise",
  reminderDays: 15,
  waPhoneNumberId: "",
  waToken: "",
  waTemplate:
    "Namaste {name} ji, your RO purifier ({product}) is due for its {service} on {date}. Reply YES to book a visit. - Sadguru Enterprise",
  festivalTemplate:
    "Sadguru Enterprise wishes you and your family a very Happy {festival}! Pure water, pure health. 💧",
  autoFestival: true,
};

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return toISO(d);
}

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
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

export function serviceDates(c: Customer): Record<ServiceKey, string> {
  return {
    service1: addMonths(c.sellingDate, 4),
    service2: addMonths(c.sellingDate, 8),
    service3: addMonths(c.sellingDate, 12),
  };
}

export type DueItem = {
  customer: Customer;
  key: ServiceKey;
  date: string;
  days: number;
  status: "overdue" | "due-soon" | "upcoming" | "done";
};

export function buildDueList(customers: Customer[], reminderDays: number): DueItem[] {
  const items: DueItem[] = [];
  for (const c of customers) {
    const dates = serviceDates(c);
    (Object.keys(dates) as ServiceKey[]).forEach((key) => {
      const date = dates[key];
      if (!date) return;
      const days = daysUntil(date);
      const status: DueItem["status"] = c.done[key]
        ? "done"
        : days < 0
          ? "overdue"
          : days <= reminderDays
            ? "due-soon"
            : "upcoming";
      items.push({ customer: c, key, date, days, status });
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export type Festival = { name: string; date: string; emoji: string };

// Indian festival calendar (dates approximate for planning; edit per year).
export const FESTIVALS: Festival[] = [
  { name: "Makar Sankranti", date: "01-14", emoji: "🪁" },
  { name: "Republic Day", date: "01-26", emoji: "🇮🇳" },
  { name: "Maha Shivratri", date: "02-15", emoji: "🔱" },
  { name: "Holi", date: "03-04", emoji: "🎨" },
  { name: "Gudi Padwa / Ugadi", date: "03-19", emoji: "🌿" },
  { name: "Ram Navami", date: "03-27", emoji: "🏹" },
  { name: "Akshaya Tritiya", date: "04-29", emoji: "✨" },
  { name: "Independence Day", date: "08-15", emoji: "🇮🇳" },
  { name: "Raksha Bandhan", date: "08-28", emoji: "🧵" },
  { name: "Janmashtami", date: "09-04", emoji: "🪈" },
  { name: "Ganesh Chaturthi", date: "09-14", emoji: "🐘" },
  { name: "Navratri", date: "10-11", emoji: "🪔" },
  { name: "Dussehra", date: "10-20", emoji: "🏹" },
  { name: "Dhanteras", date: "11-07", emoji: "🪙" },
  { name: "Diwali", date: "11-09", emoji: "🪔" },
  { name: "Bhai Dooj", date: "11-12", emoji: "🎁" },
  { name: "Christmas", date: "12-25", emoji: "🎄" },
  { name: "New Year", date: "12-31", emoji: "🎉" },
];

export function nextOccurrence(mmdd: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisYear = `${now.getFullYear()}-${mmdd}`;
  return daysUntil(thisYear) >= 0 ? thisYear : `${now.getFullYear() + 1}-${mmdd}`;
}

export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export function emptyCustomer(): Customer {
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    address: "",
    city: "",
    product: "",
    serialNo: "",
    sellingDate: toISO(new Date()),
    amount: 0,
    notes: "",
    done: { service1: false, service2: false, service3: false },
  };
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUSTOMERS_KEY);
      setCustomers(raw ? (JSON.parse(raw) as Customer[]) : []);
    } catch {
      setCustomers([]);
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Customer[]) => {
    setCustomers(next);
    window.localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(next));
  }, []);

  return { customers, loaded, persist };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    setSettings(read(SETTINGS_KEY, defaultSettings));
  }, []);

  const save = useCallback((next: Settings) => {
    setSettings(next);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  return { settings, save };
}
