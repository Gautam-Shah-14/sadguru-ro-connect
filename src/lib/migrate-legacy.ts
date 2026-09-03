import { toast } from "sonner";
import { api } from "./api";
import { applyTheme } from "./theme";
import type { Customer, Settings } from "../../shared/types";

const DONE_FLAG = "sadguru.migrated.v1";
const LEGACY_CUSTOMERS = "sadguru.customers.v1";
const LEGACY_SETTINGS = "sadguru.settings.v1";

type LegacyCustomer = Partial<Customer> & { done?: Record<string, boolean> };

/**
 * One-time import of data saved by the old browser (localStorage) build into the
 * SQLite database. Safe to call on every launch — it no-ops after the first run
 * or when there is nothing to import.
 */
export async function migrateLegacyData(): Promise<void> {
  let hasLegacy = false;
  try {
    hasLegacy = !!localStorage.getItem(LEGACY_CUSTOMERS) || !!localStorage.getItem(LEGACY_SETTINGS);
    if (localStorage.getItem(DONE_FLAG) || !hasLegacy) return;
  } catch {
    return;
  }

  try {
    const existing = await api.customers.list();

    const rawCustomers = localStorage.getItem(LEGACY_CUSTOMERS);
    if (rawCustomers && existing.length === 0) {
      const parsed = JSON.parse(rawCustomers) as LegacyCustomer[];
      const rows: Customer[] = parsed.map((c) => ({
        id: c.id ?? crypto.randomUUID(),
        name: c.name ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        product: c.product ?? "",
        serialNo: c.serialNo ?? "",
        sellingDate: c.sellingDate ?? new Date().toISOString().slice(0, 10),
        amount: Number(c.amount) || 0,
        notes: c.notes ?? "",
        done: {
          service1: !!c.done?.service1,
          service2: !!c.done?.service2,
          service3: !!c.done?.service3,
        },
        doneAt: { service1: null, service2: null, service3: null },
      }));
      if (rows.length) {
        const n = await api.customers.importRows(rows);
        toast.success(`Imported ${n} customers from your previous version`);
      }
    }

    const rawSettings = localStorage.getItem(LEGACY_SETTINGS);
    if (rawSettings) {
      const s = JSON.parse(rawSettings) as Partial<Settings>;
      const patch: Partial<Settings> = {};
      for (const k of [
        "shopName",
        "reminderDays",
        "waPhoneNumberId",
        "waTemplate",
        "festivalTemplate",
        "autoFestival",
      ] as const) {
        if (s[k] !== undefined) (patch as Record<string, unknown>)[k] = s[k];
      }
      if (Object.keys(patch).length) {
        const next = await api.settings.save(patch);
        applyTheme(next.theme);
      }
    }

    localStorage.setItem(DONE_FLAG, "1");
  } catch (err) {
    console.error("Legacy migration failed", err);
  }
}
