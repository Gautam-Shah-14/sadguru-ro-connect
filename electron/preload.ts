import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api";

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, payload)) as Envelope<T>;
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

const api: DesktopApi = {
  app: {
    info: () => invoke("app:info"),
  },
  customers: {
    list: () => invoke("customers:list"),
    save: (c) => invoke("customers:save", c),
    remove: (id) => invoke("customers:remove", id),
    setServiceDone: (id, key, done) => invoke("customers:setServiceDone", { id, key, done }),
    importRows: (rows) => invoke("customers:importRows", rows),
    importExcel: () => invoke("customers:importExcel"),
    inspectExcel: () => invoke("customers:inspectExcel"),
    importExcelMapped: (input) => invoke("customers:importExcelMapped", input),
    exportExcel: () => invoke("customers:exportExcel"),
    sampleExcel: () => invoke("customers:sampleExcel"),
  },
  settings: {
    get: () => invoke("settings:get"),
    save: (patch) => invoke("settings:save", patch),
  },
  reminders: {
    dueList: () => invoke("reminders:dueList"),
  },
  festivals: {
    list: () => invoke("festivals:list"),
    listForYear: (year) => invoke("festivals:listForYear", year),
    upsert: (f) => invoke("festivals:upsert", f),
    remove: (id) => invoke("festivals:remove", id),
    setYearDate: (input) => invoke("festivals:setYearDate", input),
    clearYearDate: (input) => invoke("festivals:clearYearDate", input),
  },
  holidays: {
    providers: () => invoke("holidays:providers"),
    setKey: (provider, key) => invoke("holidays:setKey", { provider, key }),
    testKey: (input) => invoke("holidays:testKey", input),
    preview: (input) => invoke("holidays:preview", input),
    apply: (input) => invoke("holidays:apply", input),
  },
  messages: {
    log: (opts = {}) => invoke("messages:log", opts),
    add: (entry) => invoke("messages:add", entry),
  },
  ai: {
    providers: () => invoke("ai:providers"),
    setKey: (provider, key) => invoke("ai:setKey", { provider, key }),
    testKey: (input) => invoke("ai:testKey", input),
  },
  festivalMessages: {
    list: (year) => invoke("festivalMessages:list", year),
    generate: (input) => invoke("festivalMessages:generate", input),
    generateAll: (input) => invoke("festivalMessages:generateAll", input),
    save: (input) => invoke("festivalMessages:save", input),
    reset: (input) => invoke("festivalMessages:reset", input),
  },
  whatsapp: {
    setToken: (token) => invoke("whatsapp:setToken", token),
    sendReminder: (input) => invoke("whatsapp:sendReminder", input),
    sendReminders: (items) => invoke("whatsapp:sendReminders", items),
    sendFestival: (input) => invoke("whatsapp:sendFestival", input),
    sendTest: (phone) => invoke("whatsapp:sendTest", phone),
    missedFestivals: () => invoke("whatsapp:missedFestivals"),
    runScheduler: () => invoke("whatsapp:runScheduler"),
  },
  db: {
    backup: () => invoke("db:backup"),
    restore: () => invoke("db:restore"),
  },
  window: {
    titleBarTheme: (theme) => invoke("window:titleBarTheme", theme),
  },
};

contextBridge.exposeInMainWorld("api", api);
