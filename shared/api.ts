// The contract for `window.api`, implemented by electron/preload.ts and consumed
// by the renderer via src/lib/api.ts.

import type {
  AIProviderId,
  AIProviderInfo,
  Customer,
  DueItem,
  ExcelInspection,
  Festival,
  FestivalMessageRow,
  FestivalMessageTone,
  FestivalSyncPreview,
  GenerateAllResult,
  HolidayProviderId,
  HolidayProviderInfo,
  ImportField,
  MessageKind,
  MessageLanguage,
  MessageLog,
  MessageStatus,
  ServiceKey,
  Settings,
} from "./types";

export type MessageLogInput = {
  customerId?: string | null;
  customerName?: string | null;
  kind: MessageKind;
  channel?: string;
  body: string;
  status: MessageStatus;
  error?: string | null;
};

export interface DesktopApi {
  app: {
    info(): Promise<{ version: string; dbPath: string }>;
  };
  customers: {
    list(): Promise<Customer[]>;
    save(c: Customer): Promise<Customer>;
    remove(id: string): Promise<void>;
    setServiceDone(id: string, key: ServiceKey, done: boolean): Promise<Customer>;
    importRows(rows: Customer[]): Promise<number>;
    importExcel(): Promise<{ imported: number; fileName: string | null; canceled: boolean }>;
    inspectExcel(): Promise<ExcelInspection>;
    importExcelMapped(input: {
      filePath: string;
      sheet: string;
      mapping: Record<string, ImportField | "">;
      skipDuplicates: boolean;
    }): Promise<{ imported: number; skipped: number; total: number }>;
    exportExcel(): Promise<{ saved: boolean; path: string | null }>;
    sampleExcel(): Promise<{ saved: boolean; path: string | null }>;
  };
  settings: {
    get(): Promise<Settings>;
    save(patch: Partial<Settings>): Promise<Settings>;
  };
  reminders: {
    dueList(): Promise<DueItem[]>;
  };
  festivals: {
    list(): Promise<Festival[]>;
    listForYear(year: number): Promise<Festival[]>;
    upsert(f: Partial<Festival>): Promise<Festival>;
    remove(id: string): Promise<void>;
    setYearDate(input: {
      festivalId: string;
      year: number;
      month: number;
      day: number;
    }): Promise<void>;
    clearYearDate(input: { festivalId: string; year: number }): Promise<void>;
  };
  holidays: {
    providers(): Promise<HolidayProviderInfo[]>;
    setKey(provider: HolidayProviderId, key: string): Promise<HolidayProviderInfo[]>;
    testKey(input: {
      provider: HolidayProviderId;
      key?: string;
    }): Promise<{ ok: boolean; error?: string }>;
    preview(input: { year: number }): Promise<FestivalSyncPreview>;
    apply(input: {
      year: number;
      updates: { festivalId: string; iso: string }[];
      additions?: { name: string; iso: string }[];
      provider: HolidayProviderId;
    }): Promise<{ updated: number; added: number }>;
  };
  messages: {
    log(opts?: { kind?: MessageKind; limit?: number }): Promise<MessageLog[]>;
    add(entry: MessageLogInput): Promise<MessageLog>;
  };
  ai: {
    providers(): Promise<AIProviderInfo[]>;
    setKey(provider: AIProviderId, key: string): Promise<AIProviderInfo[]>;
    testKey(input: {
      provider: AIProviderId;
      model?: string;
      key?: string;
    }): Promise<{ ok: boolean; error?: string }>;
  };
  festivalMessages: {
    list(year: number): Promise<FestivalMessageRow[]>;
    generate(input: {
      festivalId: string;
      year: number;
      language: MessageLanguage;
      tone?: FestivalMessageTone;
    }): Promise<FestivalMessageRow>;
    generateAll(input: {
      year: number;
      languages?: MessageLanguage[];
      tone?: FestivalMessageTone;
    }): Promise<GenerateAllResult>;
    save(input: {
      festivalId: string;
      year: number;
      language: MessageLanguage;
      body: string;
    }): Promise<FestivalMessageRow>;
    reset(input: { festivalId: string; year: number; language: MessageLanguage }): Promise<void>;
  };
  whatsapp: {
    setToken(token: string): Promise<{ configured: boolean }>;
    sendReminder(input: {
      customerId: string;
      key: ServiceKey;
    }): Promise<{ status: string; error?: string }>;
    sendReminders(
      items: { customerId: string; key: ServiceKey }[],
    ): Promise<{ sent: number; dryRun: number; failed: number }>;
    sendFestival(input: {
      festivalId: string;
      year: number;
      language: MessageLanguage;
    }): Promise<{ sent: number; dryRun: number; failed: number; skipped: number }>;
    sendTest(phone: string): Promise<{ ok: boolean; dryRun: boolean; error?: string }>;
    missedFestivals(): Promise<
      { id: string; name: string; emoji: string; year: number; daysAgo: number }[]
    >;
    runScheduler(): Promise<void>;
  };
  db: {
    backup(): Promise<{ saved: boolean; path: string | null }>;
    restore(): Promise<{ restored: boolean; error?: string }>;
  };
  window: {
    titleBarTheme(theme: "light" | "dark"): Promise<void>;
  };
}
