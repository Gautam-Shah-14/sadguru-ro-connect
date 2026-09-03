import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { copyFileSync, openSync, readSync, closeSync, rmSync, existsSync } from "node:fs";
import { closeDb, dbPath } from "./db";
import {
  exportExcelViaDialog,
  importExcelMapped,
  importExcelViaDialog,
  importRows,
  inspectExcelViaDialog,
  listCustomers,
  removeCustomer,
  sampleExcelViaDialog,
  saveCustomer,
  setServiceDone,
} from "./services/customers";
import { getSettings, saveSettings } from "./services/settings";
import { dueList } from "./services/reminders";
import {
  clearFestivalYearDate,
  listFestivals,
  listFestivalsForYear,
  removeFestival,
  setFestivalYearDate,
  upsertFestival,
} from "./services/festivals";
import {
  applyFestivalSync,
  listHolidayProviders,
  previewFestivalSync,
  saveHolidayKey,
  testHolidayKey,
} from "./services/holidays";
import { listMessageLog, logMessage } from "./services/messages";
import { listProviders, saveProviderKey, testProviderKey } from "./services/ai/config";
import {
  generateAllFestivalMessages,
  generateFestivalMessage,
  listFestivalMessages,
  resetFestivalMessage,
  saveFestivalMessage,
} from "./services/festivalMessages";
import { setSecret } from "./services/secrets";
import {
  sendFestivalGreeting,
  sendServiceReminder,
  sendServiceRemindersBulk,
  sendTestMessage,
} from "./services/whatsapp";
import { missedFestivals, runSchedulerTick } from "./services/scheduler";
import { applyTitleBarTheme } from "./titlebar";
import type {
  AIProviderId,
  Customer,
  Festival,
  HolidayProviderId,
  ImportField,
  MessageKind,
  MessageLanguage,
  ServiceKey,
  Settings,
} from "../shared/types";

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

/** Map of channel -> handler. Every handler is awaited and its result returned to the renderer. */
const handlers: Record<string, (payload: any) => unknown | Promise<unknown>> = {
  "app:info": () => ({ version: app.getVersion(), dbPath: dbPath() }),

  "customers:list": () => listCustomers(),
  "customers:save": (c: Customer) => saveCustomer(c),
  "customers:remove": (id: string) => removeCustomer(id),
  "customers:setServiceDone": (p: { id: string; key: ServiceKey; done: boolean }) =>
    setServiceDone(p.id, p.key, p.done),
  "customers:importRows": (rows: Customer[]) => importRows(rows),
  "customers:importExcel": () => importExcelViaDialog(focusedWindow()),
  "customers:sampleExcel": () => sampleExcelViaDialog(focusedWindow()),
  "customers:inspectExcel": () => inspectExcelViaDialog(focusedWindow()),
  "customers:importExcelMapped": (p: {
    filePath: string;
    sheet: string;
    mapping: Record<string, ImportField | "">;
    skipDuplicates: boolean;
  }) => importExcelMapped(p),
  "customers:exportExcel": () => exportExcelViaDialog(focusedWindow()),

  "settings:get": () => getSettings(),
  "settings:save": (patch: Partial<Settings>) => saveSettings(patch),

  "reminders:dueList": () => dueList(),

  "festivals:list": () => listFestivals(),
  "festivals:listForYear": (year: number) => listFestivalsForYear(year),
  "festivals:upsert": (f: Partial<Festival>) => upsertFestival(f),
  "festivals:remove": (id: string) => removeFestival(id),
  "festivals:setYearDate": (p: { festivalId: string; year: number; month: number; day: number }) =>
    setFestivalYearDate(p.festivalId, p.year, p.month, p.day, "manual"),
  "festivals:clearYearDate": (p: { festivalId: string; year: number }) =>
    clearFestivalYearDate(p.festivalId, p.year),

  "holidays:providers": () => listHolidayProviders(),
  "holidays:setKey": (p: { provider: HolidayProviderId; key: string }) =>
    saveHolidayKey(p.provider, p.key),
  "holidays:testKey": (p: { provider: HolidayProviderId; key?: string }) =>
    testHolidayKey(p.provider, p.key),
  "holidays:preview": (p: { year: number }) => previewFestivalSync(p.year),
  "holidays:apply": (p: {
    year: number;
    updates: { festivalId: string; iso: string }[];
    additions?: { name: string; iso: string }[];
    provider: HolidayProviderId;
  }) => applyFestivalSync(p.year, { updates: p.updates, additions: p.additions ?? [] }, p.provider),

  "messages:log": (p: { kind?: MessageKind; limit?: number } = {}) => listMessageLog(p),
  "messages:add": (entry: Parameters<typeof logMessage>[0]) => logMessage(entry),

  "ai:providers": () => listProviders(),
  "ai:setKey": (p: { provider: AIProviderId; key: string }) => saveProviderKey(p.provider, p.key),
  "ai:testKey": (p: { provider: AIProviderId; model?: string; key?: string }) => testProviderKey(p),

  "festivalMessages:list": (year: number) => listFestivalMessages(year),
  "festivalMessages:generate": (p: {
    festivalId: string;
    year: number;
    language: MessageLanguage;
    tone?: "warm" | "formal" | "playful";
  }) => generateFestivalMessage(p),
  "festivalMessages:generateAll": (p: {
    year: number;
    languages?: MessageLanguage[];
    tone?: "warm" | "formal" | "playful";
  }) => generateAllFestivalMessages(p),
  "festivalMessages:save": (p: {
    festivalId: string;
    year: number;
    language: MessageLanguage;
    body: string;
  }) => saveFestivalMessage(p),
  "festivalMessages:reset": (p: { festivalId: string; year: number; language: MessageLanguage }) =>
    resetFestivalMessage(p),

  "whatsapp:setToken": (token: string) => {
    setSecret("whatsapp.token", token.trim());
    return { configured: !!token.trim() };
  },
  "whatsapp:sendReminder": (p: { customerId: string; key: ServiceKey }) => sendServiceReminder(p),
  "whatsapp:sendReminders": (items: { customerId: string; key: ServiceKey }[]) =>
    sendServiceRemindersBulk(items),
  "whatsapp:sendFestival": (p: { festivalId: string; year: number; language: MessageLanguage }) =>
    sendFestivalGreeting(p),
  "whatsapp:sendTest": (phone: string) => sendTestMessage(phone),
  "whatsapp:missedFestivals": () => missedFestivals(),
  "whatsapp:runScheduler": () => runSchedulerTick(),

  "window:titleBarTheme": (theme: "light" | "dark") => applyTitleBarTheme(theme),

  "db:backup": async () => {
    const win = focusedWindow();
    const opts = {
      title: "Backup database",
      defaultPath: `sadguru-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: "SQLite database", extensions: ["db"] }],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { saved: false, path: null };
    copyFileSync(dbPath(), res.filePath);
    return { saved: true, path: res.filePath };
  },

  "db:restore": async () => {
    const win = focusedWindow();
    const opts = {
      title: "Restore database from backup",
      filters: [{ name: "SQLite database", extensions: ["db"] }],
      properties: ["openFile" as const],
    };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    if (res.canceled || !res.filePaths[0]) return { restored: false };

    const src = res.filePaths[0];
    const head = Buffer.alloc(16);
    const fd = openSync(src, "r");
    readSync(fd, head, 0, 16, 0);
    closeSync(fd);
    if (head.toString("latin1") !== "SQLite format 3\0") {
      return { restored: false, error: "That file is not a SQLite database." };
    }

    const target = dbPath();
    closeDb();
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(target + suffix)) rmSync(target + suffix);
    }
    copyFileSync(src, target);

    app.relaunch();
    app.exit(0);
    return { restored: true };
  },
};

export function registerIpc(): void {
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, data: await fn(payload) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ipc] ${channel} failed:`, err);
        return { ok: false, error: message };
      }
    });
  }
}

export const IPC_CHANNELS = Object.keys(handlers);
