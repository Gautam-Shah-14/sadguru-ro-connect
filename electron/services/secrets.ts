import { safeStorage } from "electron";
import { getDb } from "../db";

// Secrets (AI API keys, WhatsApp token) live in the settings table under reserved
// keys, encrypted with the OS keychain via Electron safeStorage when available.
// Value format: "enc:<base64>" (encrypted) or "raw:<base64>" (fallback, e.g. Linux
// without a keyring). The renderer never receives these — only a boolean.

const PREFIX_ENC = "enc:";
const PREFIX_RAW = "raw:";

function put(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, JSON.stringify(value));
}

function rawGet(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as string;
  } catch {
    return row.value;
  }
}

export function setSecret(key: string, plain: string): void {
  if (!plain) {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
    return;
  }
  if (safeStorage.isEncryptionAvailable()) {
    put(key, PREFIX_ENC + safeStorage.encryptString(plain).toString("base64"));
  } else {
    put(key, PREFIX_RAW + Buffer.from(plain, "utf8").toString("base64"));
  }
}

export function getSecret(key: string): string | null {
  const stored = rawGet(key);
  if (!stored) return null;
  if (stored.startsWith(PREFIX_ENC)) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(PREFIX_ENC.length), "base64"));
    } catch {
      return null;
    }
  }
  if (stored.startsWith(PREFIX_RAW)) {
    return Buffer.from(stored.slice(PREFIX_RAW.length), "base64").toString("utf8");
  }
  // Legacy plain value.
  return stored;
}

export function hasSecret(key: string): boolean {
  return !!rawGet(key);
}

export function clearSecret(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}
