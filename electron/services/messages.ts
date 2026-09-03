import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { MessageKind, MessageLanguage, MessageLog, MessageStatus } from "../../shared/types";

type Row = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  kind: MessageKind;
  channel: string;
  body: string;
  status: MessageStatus;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  festival_id: string | null;
  year: number | null;
  language: string | null;
};

const toLog = (r: Row): MessageLog => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.customer_name,
  kind: r.kind,
  channel: r.channel,
  body: r.body,
  status: r.status,
  error: r.error,
  createdAt: r.created_at,
  sentAt: r.sent_at,
  festivalId: r.festival_id,
  year: r.year,
  language: (r.language as MessageLanguage | null) ?? null,
});

export type LogInput = {
  customerId?: string | null;
  customerName?: string | null;
  kind: MessageKind;
  channel?: string;
  body: string;
  status: MessageStatus;
  error?: string | null;
  festivalId?: string | null;
  year?: number | null;
  language?: MessageLanguage | null;
};

export function logMessage(entry: LogInput): MessageLog {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO message_log
         (id, customer_id, customer_name, kind, channel, body, status, error, sent_at,
          festival_id, year, language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      entry.customerId ?? null,
      entry.customerName ?? null,
      entry.kind,
      entry.channel ?? "whatsapp",
      entry.body,
      entry.status,
      entry.error ?? null,
      entry.status === "sent" || entry.status === "dry-run" ? new Date().toISOString() : null,
      entry.festivalId ?? null,
      entry.year ?? null,
      entry.language ?? null,
    );
  return toLog(getDb().prepare("SELECT * FROM message_log WHERE id = ?").get(id) as Row);
}

export function listMessageLog(opts: { limit?: number; kind?: MessageKind } = {}): MessageLog[] {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
  const rows = opts.kind
    ? (getDb()
        .prepare(
          "SELECT * FROM message_log WHERE kind = ? ORDER BY datetime(created_at) DESC LIMIT ?",
        )
        .all(opts.kind, limit) as Row[])
    : (getDb()
        .prepare("SELECT * FROM message_log ORDER BY datetime(created_at) DESC LIMIT ?")
        .all(limit) as Row[]);
  return rows.map(toLog);
}

/** How many times a festival greeting has already gone out (sent or dry-run) for a year. */
export function festivalSendCount(festivalId: string, year: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM message_log
       WHERE kind = 'festival' AND festival_id = ? AND year = ?
       AND status IN ('sent','dry-run')`,
    )
    .get(festivalId, year) as { c: number };
  return row.c;
}

/** Most recent log entry for a customer + service message (for the reminders screen). */
export function lastServiceStatus(customerId: string): MessageLog | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM message_log WHERE kind = 'service' AND customer_id = ?
       ORDER BY datetime(created_at) DESC LIMIT 1`,
    )
    .get(customerId) as Row | undefined;
  return row ? toLog(row) : null;
}
