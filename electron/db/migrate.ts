import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { FESTIVALS_SEED } from "../../shared/domain";

type Migration = { version: number; up: string };

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE customers (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL DEFAULT '',
        phone         TEXT NOT NULL DEFAULT '',
        address       TEXT NOT NULL DEFAULT '',
        city          TEXT NOT NULL DEFAULT '',
        product       TEXT NOT NULL DEFAULT '',
        serial_no     TEXT NOT NULL DEFAULT '',
        selling_date  TEXT NOT NULL DEFAULT '',
        amount        REAL NOT NULL DEFAULT 0,
        notes         TEXT NOT NULL DEFAULT '',
        service1_done INTEGER NOT NULL DEFAULT 0,
        service2_done INTEGER NOT NULL DEFAULT 0,
        service3_done INTEGER NOT NULL DEFAULT 0,
        service1_done_at TEXT,
        service2_done_at TEXT,
        service3_done_at TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE festivals (
        id     TEXT PRIMARY KEY,
        name   TEXT NOT NULL,
        month  INTEGER NOT NULL,
        day    INTEGER NOT NULL,
        emoji  TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        sort   INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE festival_messages (
        id          TEXT PRIMARY KEY,
        festival_id TEXT NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
        year        INTEGER NOT NULL,
        language    TEXT NOT NULL,
        tone        TEXT NOT NULL DEFAULT 'warm',
        body        TEXT NOT NULL DEFAULT '',
        source      TEXT NOT NULL DEFAULT 'template',
        provider    TEXT,
        model       TEXT,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (festival_id, year, language)
      );

      CREATE TABLE message_log (
        id          TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        kind        TEXT NOT NULL,
        channel     TEXT NOT NULL DEFAULT 'whatsapp',
        body        TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'queued',
        error       TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at     TEXT
      );

      CREATE INDEX idx_message_log_created ON message_log(created_at DESC);
      CREATE INDEX idx_festival_messages_lookup ON festival_messages(festival_id, year, language);
    `,
  },
  {
    version: 2,
    up: `
      ALTER TABLE message_log ADD COLUMN festival_id TEXT;
      ALTER TABLE message_log ADD COLUMN year INTEGER;
      ALTER TABLE message_log ADD COLUMN language TEXT;
      CREATE INDEX idx_message_log_festival ON message_log(kind, festival_id, year);
    `,
  },
  {
    version: 3,
    up: `
      CREATE TABLE festival_dates (
        festival_id TEXT NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
        year        INTEGER NOT NULL,
        month       INTEGER NOT NULL,
        day         INTEGER NOT NULL,
        source      TEXT NOT NULL DEFAULT 'manual',
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (festival_id, year)
      );
    `,
  },
  {
    version: 4,
    // Reverted: servicing stays at 3 visits (4/8/12 months). This slot is kept
    // as a no-op so version numbering remains consistent across installs.
    up: `SELECT 1;`,
  },
];

export function runMigrations(db: DatabaseSync): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_meta").get() as { v: number | null };
  const current = row?.v ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.exec("BEGIN");
    try {
      db.exec(m.up);
      db.prepare("INSERT INTO schema_meta (version) VALUES (?)").run(m.version);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  seedFestivals(db);
}

function seedFestivals(db: DatabaseSync): void {
  const count = (db.prepare("SELECT COUNT(*) AS c FROM festivals").get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare(
    "INSERT INTO festivals (id, name, month, day, emoji, active, sort) VALUES (?, ?, ?, ?, ?, 1, ?)",
  );
  db.exec("BEGIN");
  try {
    FESTIVALS_SEED.forEach((f, i) => insert.run(randomUUID(), f.name, f.month, f.day, f.emoji, i));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
