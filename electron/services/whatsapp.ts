import { fillTemplate, normalizePhone, serviceDates, SERVICE_LABELS } from "../../shared/domain";
import { formatIN } from "../../shared/domain";
import type { DueItem, MessageLanguage } from "../../shared/types";

export { normalizePhone };
import { getSettings } from "./settings";
import { getSecret } from "./secrets";
import { listCustomers, getCustomer } from "./customers";
import { logMessage } from "./messages";
import { resolveFestivalBody } from "./festivalMessages";
import { getFestival } from "./festivals";

const GRAPH_VERSION = "v21.0";

type SendResult = { ok: boolean; dryRun: boolean; error?: string; id?: string };

async function sendRaw(to: string, payloadBody: Record<string, unknown>): Promise<SendResult> {
  const s = getSettings();
  const token = getSecret("whatsapp.token");

  if (s.waDryRun) return { ok: true, dryRun: true };
  if (!s.waPhoneNumberId || !token) {
    return {
      ok: false,
      dryRun: false,
      error: "WhatsApp phone number ID or access token is not set.",
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${s.waPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", to, ...payloadBody }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = json?.error?.message || json?.error?.error_data?.details || `HTTP ${res.status}`;
      return { ok: false, dryRun: false, error: String(msg) };
    }
    return { ok: true, dryRun: false, id: json?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, dryRun: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Build the payload for a personalized message: template if configured, else free text. */
function messagePayload(text: string, customerName: string, langCode: string) {
  const s = getSettings();
  if (s.waTemplateName) {
    return {
      type: "template",
      template: {
        name: s.waTemplateName,
        language: { code: langCode || s.waLanguageCode || "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: customerName || "customer" }] },
        ],
      },
    };
  }
  return {
    type: "text",
    text: { body: text.replace(/\{name\}/g, customerName || "").trim(), preview_url: false },
  };
}

/* ------------------------------- service reminders ------------------------------- */

function serviceMessage(item: DueItem): string {
  const s = getSettings();
  return fillTemplate(s.waTemplate, {
    name: item.customer.name,
    product: item.customer.product || "RO purifier",
    service: SERVICE_LABELS[item.key],
    date: formatIN(item.date),
    shop: s.shopName,
  });
}

export async function sendServiceReminder(input: {
  customerId: string;
  key: DueItem["key"];
}): Promise<{ status: string; error?: string }> {
  const customer = getCustomer(input.customerId);
  if (!customer) return { status: "failed", error: "Customer not found." };
  const dates = serviceDates(customer);
  const item: DueItem = {
    customer,
    key: input.key,
    date: dates[input.key],
    days: 0,
    status: "due-soon",
  };
  const body = serviceMessage(item);
  const phone = normalizePhone(customer.phone);

  if (!phone) {
    logMessage({
      customerId: customer.id,
      customerName: customer.name,
      kind: "service",
      body,
      status: "failed",
      error: "Invalid phone number.",
    });
    return { status: "failed", error: "Invalid phone number." };
  }

  const res = await sendRaw(
    phone,
    messagePayload(body, customer.name, getSettings().waLanguageCode),
  );
  const status = res.dryRun ? "dry-run" : res.ok ? "sent" : "failed";
  logMessage({
    customerId: customer.id,
    customerName: customer.name,
    kind: "service",
    body,
    status,
    error: res.error ?? null,
  });
  return { status, ...(res.error ? { error: res.error } : {}) };
}

export async function sendServiceRemindersBulk(
  items: { customerId: string; key: DueItem["key"] }[],
): Promise<{ sent: number; dryRun: number; failed: number }> {
  let sent = 0,
    dryRun = 0,
    failed = 0;
  for (const it of items) {
    const r = await sendServiceReminder(it);
    if (r.status === "sent") sent++;
    else if (r.status === "dry-run") dryRun++;
    else failed++;
  }
  return { sent, dryRun, failed };
}

/* ---------------------------------- festivals ---------------------------------- */

export async function sendFestivalGreeting(input: {
  festivalId: string;
  year: number;
  language: MessageLanguage;
}): Promise<{ sent: number; dryRun: number; failed: number; skipped: number }> {
  const festival = getFestival(input.festivalId);
  if (!festival) throw new Error("Festival not found.");

  const { body } = resolveFestivalBody(festival.id, festival.name, input.year, input.language);
  const customers = listCustomers();
  const langCode = input.language === "gu" ? "gu" : "en";

  let sent = 0,
    dryRun = 0,
    failed = 0,
    skipped = 0;

  for (const c of customers) {
    const phone = normalizePhone(c.phone);
    if (!phone) {
      skipped++;
      logMessage({
        customerId: c.id,
        customerName: c.name,
        kind: "festival",
        body,
        status: "failed",
        error: "Invalid phone number.",
        festivalId: festival.id,
        year: input.year,
        language: input.language,
      });
      continue;
    }
    const res = await sendRaw(phone, messagePayload(body, c.name, langCode));
    const status = res.dryRun ? "dry-run" : res.ok ? "sent" : "failed";
    if (status === "sent") sent++;
    else if (status === "dry-run") dryRun++;
    else failed++;
    logMessage({
      customerId: c.id,
      customerName: c.name,
      kind: "festival",
      body: body.replace(/\{name\}/g, c.name || ""),
      status,
      error: res.error ?? null,
      festivalId: festival.id,
      year: input.year,
      language: input.language,
    });
  }
  return { sent, dryRun, failed, skipped };
}

/* ----------------------------------- test ----------------------------------- */

export async function sendTestMessage(
  phoneRaw: string,
): Promise<{ ok: boolean; dryRun: boolean; error?: string }> {
  const phone = normalizePhone(phoneRaw);
  const s = getSettings();
  const body = `Test message from ${s.shopName} — WhatsApp is connected. 💧`;
  if (!phone) {
    logMessage({ kind: "service", body, status: "failed", error: "Invalid phone number." });
    return { ok: false, dryRun: false, error: "Invalid phone number." };
  }
  const res = await sendRaw(phone, messagePayload(body, "there", "en"));
  logMessage({
    kind: "service",
    body,
    status: res.dryRun ? "dry-run" : res.ok ? "sent" : "failed",
    error: res.error ?? null,
  });
  return { ok: res.ok, dryRun: res.dryRun, ...(res.error ? { error: res.error } : {}) };
}
