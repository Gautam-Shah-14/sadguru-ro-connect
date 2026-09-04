import { getDb, transaction } from "../db";
import { hasSecret } from "./secrets";
import type { Settings } from "../../shared/types";

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Sadguru Enterprise",
  reminderDays: 15,
  theme: "light",

  waPhoneNumberId: "",
  waToken: "",
  waTokenConfigured: false,
  waTemplate:
    "Namaste {name} ji, your RO purifier ({product}) is due for its {service} on {date}. Reply YES to book a visit. - Sadguru Enterprise",
  waTemplateName: "",
  waLanguageCode: "en",
  waDryRun: true,

  festivalTemplate:
    "Sadguru Enterprise wishes you and your family a very Happy {festival}! Pure water, pure health. 💧",
  autoFestival: true,
  festivalLanguages: ["en", "gu"],
  holidayProvider: "calendarific",
  autoSyncFestivals: true,

  aiProvider: "claude",
  aiModel: "",
  aiTone: "warm",
  aiKeyConfigured: {},
};

// Patch keys that are never written verbatim by saveSettings (secrets / derived).
const NON_WRITABLE = new Set([
  "ai.claude.key",
  "ai.openai.key",
  "ai.gemini.key",
  "ai.groq.key",
  "aiKeyConfigured",
  "waToken",
  "waTokenConfigured",
]);

function readRaw(): Record<string, unknown> {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

function writeKey(key: string, value: unknown): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, JSON.stringify(value));
}

/** Full settings object for the renderer — secrets replaced with booleans. */
export function getSettings(): Settings {
  const raw = readRaw();
  const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (raw[k] !== undefined) merged[k] = raw[k];
  }

  const aiKeyConfigured: Settings["aiKeyConfigured"] = {};
  for (const p of ["claude", "openai", "gemini", "groq"] as const) {
    aiKeyConfigured[p] = Boolean(raw[`ai.${p}.key`]);
  }
  merged["aiKeyConfigured"] = aiKeyConfigured;
  merged["waToken"] = "";
  merged["waTokenConfigured"] = hasSecret("whatsapp.token");

  return merged as Settings;
}

/** Small internal key/value store (not exposed to the renderer as Settings). */
export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(`meta.${key}`) as
    { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as string;
  } catch {
    return row.value;
  }
}

export function setMeta(key: string, value: string): void {
  writeKey(`meta.${key}`, value);
}

/** Persist a partial patch of user-editable settings (never secrets). */
export function saveSettings(patch: Partial<Settings>): Settings {
  transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (NON_WRITABLE.has(k)) continue;
      writeKey(k, v);
    }
  });
  return getSettings();
}
