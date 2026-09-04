import { app } from "electron";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { runMigrations } from "./migrate";

export type DB = DatabaseSync;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = app.getPath("userData");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, "sadguru.db");

  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function dbPath(): string {
  return join(app.getPath("userData"), "sadguru.db");
}

export function closeDb(): void {
  db?.close();
  db = null;
}

/** Run `fn` inside a single transaction, rolling back on any thrown error. */
export function transaction<T>(fn: () => T): T {
  const conn = getDb();
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}
