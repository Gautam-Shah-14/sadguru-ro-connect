// Shared type contracts used by BOTH the Electron main process (backend) and the
// React renderer. Keep this file free of any runtime imports from either side.

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
  doneAt: Record<ServiceKey, string | null>;
  createdAt?: string;
  updatedAt?: string;
};

export type AIProviderId = "claude" | "openai" | "gemini" | "groq";

export type MessageLanguage = "en" | "gu";

export const LANGUAGE_LABELS: Record<MessageLanguage, string> = {
  en: "English",
  gu: "ગુજરાતી (Gujarati)",
};

export type FestivalMessageTone = "warm" | "formal" | "playful";

export type AIProviderInfo = {
  id: AIProviderId;
  label: string;
  models: string[];
  defaultModel: string;
  keyConfigured: boolean;
  keyUrl: string;
};

export type Settings = {
  shopName: string;
  reminderDays: number;
  theme: "light" | "dark";

  // WhatsApp Cloud API (token is stored encrypted; renderer sees waTokenConfigured)
  waPhoneNumberId: string;
  waToken: string;
  waTokenConfigured: boolean;
  waTemplate: string;
  waTemplateName: string; // optional Meta-approved template; blank = free-text body
  waLanguageCode: string; // template language, e.g. "en" / "gu"
  waDryRun: boolean;

  // Festival messaging
  festivalTemplate: string;
  autoFestival: boolean;
  festivalLanguages: MessageLanguage[];
  holidayProvider: HolidayProviderId;
  autoSyncFestivals: boolean;

  // AI assistant (keys are stored encrypted; renderer only sees `aiKeyConfigured`)
  aiProvider: AIProviderId;
  aiModel: string;
  aiTone: FestivalMessageTone;
  aiKeyConfigured: Partial<Record<AIProviderId, boolean>>;
};

export type ImportField =
  | "id"
  | "name"
  | "phone"
  | "address"
  | "city"
  | "product"
  | "serialNo"
  | "sellingDate"
  | "amount"
  | "notes";

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  id: "Customer ID",
  name: "Customer name",
  phone: "Phone / WhatsApp",
  address: "Address",
  city: "City / Area",
  product: "Product / Model",
  serialNo: "Serial number",
  sellingDate: "Selling date",
  amount: "Amount",
  notes: "Notes",
};

export type ExcelSheetInfo = {
  name: string;
  columns: string[];
  sample: Record<string, string>[];
};

export type ExcelInspection = {
  canceled: boolean;
  filePath: string | null;
  fileName: string | null;
  sheets: ExcelSheetInfo[];
  autoMap: Record<string, ImportField | "">;
};

export type DueStatus = "overdue" | "due-soon" | "upcoming" | "done";

export type DueItem = {
  customer: Customer;
  key: ServiceKey;
  date: string;
  days: number;
  status: DueStatus;
};

export type FestivalDateSource = "default" | "manual" | "calendarific" | "apininjas";

export type Festival = {
  id: string;
  name: string;
  month: number; // 1-12 — the recurring/default date
  day: number; // 1-31
  emoji: string;
  active: boolean;
  sort: number;
  /** Present only on listForYear(): where this year's month/day came from. */
  dateSource?: FestivalDateSource;
};

export type HolidayProviderId = "calendarific" | "apininjas";

export type HolidayProviderInfo = {
  id: HolidayProviderId;
  label: string;
  keyConfigured: boolean;
  keyUrl: string;
  note: string;
};

export type FestivalSyncMatch = {
  festivalId: string;
  festivalName: string;
  currentIso: string;
  newIso: string;
  holidayName: string;
  changed: boolean;
};

export type FestivalSyncPreview = {
  year: number;
  provider: HolidayProviderId;
  matches: FestivalSyncMatch[];
  unmatchedFestivals: { festivalId: string; name: string }[];
  unmatchedHolidays: { name: string; iso: string }[];
};

export type FestivalMessageSource = "ai" | "manual" | "template";

export type FestivalMessage = {
  id: string;
  festivalId: string;
  year: number;
  language: MessageLanguage;
  tone: string;
  body: string;
  source: FestivalMessageSource;
  provider: string | null;
  model: string | null;
  updatedAt: string;
};

export type FestivalMessageRow = FestivalMessage & { festivalName: string };

export type GenerateAllResult = {
  generated: number;
  failed: { festival: string; language: MessageLanguage; error: string }[];
};

export type MessageKind = "service" | "festival";
export type MessageStatus = "queued" | "sent" | "failed" | "dry-run";

export type MessageLog = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  kind: MessageKind;
  channel: string;
  body: string;
  status: MessageStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  festivalId: string | null;
  year: number | null;
  language: MessageLanguage | null;
};
