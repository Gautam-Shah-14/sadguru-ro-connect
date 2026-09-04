import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { applyTheme } from "./theme";
import type {
  Customer,
  DueItem,
  Festival,
  MessageLog,
  ServiceKey,
  Settings,
} from "../../shared/types";

export type { Customer, DueItem, Festival, MessageLog, ServiceKey, Settings };

// Re-export the shared pure helpers so existing imports from "@/lib/store" keep working.
export {
  addMonths,
  buildDueList,
  daysUntil,
  fillTemplate,
  formatIN,
  nextOccurrence,
  serviceDates,
  toISO,
  SERVICE_KEYS,
  SERVICE_LABELS,
  SERVICE_OFFSETS,
} from "../../shared/domain";

export function emptyCustomer(): Customer {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "", // blank → backend assigns one unless the user types their own
    name: "",
    phone: "",
    address: "",
    city: "",
    product: "",
    serialNo: "",
    sellingDate: today,
    amount: 0,
    notes: "",
    done: { service1: false, service2: false, service3: false },
    doneAt: { service1: null, service2: null, service3: null },
  };
}

const CUSTOMERS_KEY = ["customers"] as const;
const SETTINGS_KEY = ["settings"] as const;
const REMINDERS_KEY = ["reminders"] as const;
const FESTIVALS_KEY = ["festivals"] as const;

export function useCustomers() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: CUSTOMERS_KEY, queryFn: () => api.customers.list() });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    void qc.invalidateQueries({ queryKey: REMINDERS_KEY });
  }, [qc]);

  const save = useMutation({
    mutationFn: (c: Customer) => api.customers.save(c),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.customers.remove(id),
    onSuccess: refresh,
  });
  const setDone = useMutation({
    mutationFn: (p: { id: string; key: ServiceKey; done: boolean }) =>
      api.customers.setServiceDone(p.id, p.key, p.done),
    onSuccess: refresh,
  });
  const importRows = useMutation({
    mutationFn: (rows: Customer[]) => api.customers.importRows(rows),
    onSuccess: refresh,
  });

  return {
    customers: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    saveCustomer: (c: Customer) => save.mutateAsync(c),
    removeCustomer: (id: string) => remove.mutateAsync(id),
    setServiceDone: (id: string, key: ServiceKey, done: boolean) =>
      setDone.mutateAsync({ id, key, done }),
    importRows: (rows: Customer[]) => importRows.mutateAsync(rows),
    refresh,
  };
}

export function useDueList() {
  const query = useQuery({ queryKey: REMINDERS_KEY, queryFn: () => api.reminders.dueList() });
  return { dueList: query.data ?? [], loading: query.isLoading };
}

export function useSettings() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: () => api.settings.get() });
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.settings.save(patch),
    onSuccess: (next) => {
      qc.setQueryData(SETTINGS_KEY, next);
      if (next.theme) applyTheme(next.theme);
    },
  });
  return {
    settings: query.data,
    loading: query.isLoading,
    saveSettings: (patch: Partial<Settings>) => save.mutateAsync(patch),
  };
}

export function useFestivals(year?: number) {
  const qc = useQueryClient();
  const key = year ? ["festivals", year] : FESTIVALS_KEY;
  const query = useQuery({
    queryKey: key,
    queryFn: () => (year ? api.festivals.listForYear(year) : api.festivals.list()),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["festivals"] });
    void qc.invalidateQueries({ queryKey: ["reminders"] });
  };
  const upsert = useMutation({
    mutationFn: (f: Partial<Festival>) => api.festivals.upsert(f),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.festivals.remove(id),
    onSuccess: refresh,
  });
  const setYearDate = useMutation({
    mutationFn: (p: { festivalId: string; year: number; month: number; day: number }) =>
      api.festivals.setYearDate(p),
    onSuccess: refresh,
  });
  return {
    festivals: query.data ?? [],
    loading: query.isLoading,
    refresh,
    upsertFestival: (f: Partial<Festival>) => upsert.mutateAsync(f),
    removeFestival: (id: string) => remove.mutateAsync(id),
    setFestivalYearDate: (p: { festivalId: string; year: number; month: number; day: number }) =>
      setYearDate.mutateAsync(p),
  };
}
