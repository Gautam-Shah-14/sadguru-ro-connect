import { randomUUID } from "node:crypto";
import { getDb, transaction } from "../db";
import { fillTemplate } from "../../shared/domain";
import type {
  AIProviderId,
  FestivalMessage,
  FestivalMessageRow,
  FestivalMessageTone,
  MessageLanguage,
} from "../../shared/types";
import { getSettings } from "./settings";
import { getSecret } from "./secrets";
import { defaultModel } from "./ai/models";
import { generate } from "./ai";

export type { FestivalMessageRow };

type DbRow = {
  id: string;
  festival_id: string;
  year: number;
  language: MessageLanguage;
  tone: string;
  body: string;
  source: FestivalMessage["source"];
  provider: string | null;
  model: string | null;
  updated_at: string;
  festival_name: string;
};

const toRow = (r: DbRow): FestivalMessageRow => ({
  id: r.id,
  festivalId: r.festival_id,
  year: r.year,
  language: r.language,
  tone: r.tone,
  body: r.body,
  source: r.source,
  provider: r.provider,
  model: r.model,
  updatedAt: r.updated_at,
  festivalName: r.festival_name,
});

const SELECT = `
  SELECT m.*, f.name AS festival_name
  FROM festival_messages m
  JOIN festivals f ON f.id = m.festival_id
`;

export function listFestivalMessages(year: number): FestivalMessageRow[] {
  const rows = getDb()
    .prepare(`${SELECT} WHERE m.year = ? ORDER BY f.sort, m.language`)
    .all(year) as DbRow[];
  return rows.map(toRow);
}

function getOne(
  festivalId: string,
  year: number,
  language: MessageLanguage,
): FestivalMessageRow | null {
  const row = getDb()
    .prepare(`${SELECT} WHERE m.festival_id = ? AND m.year = ? AND m.language = ?`)
    .get(festivalId, year, language) as DbRow | undefined;
  return row ? toRow(row) : null;
}

function upsert(m: {
  festivalId: string;
  year: number;
  language: MessageLanguage;
  tone: string;
  body: string;
  source: FestivalMessage["source"];
  provider: string | null;
  model: string | null;
}): FestivalMessageRow {
  const existing = getDb()
    .prepare("SELECT id FROM festival_messages WHERE festival_id = ? AND year = ? AND language = ?")
    .get(m.festivalId, m.year, m.language) as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  getDb()
    .prepare(
      `INSERT INTO festival_messages
         (id, festival_id, year, language, tone, body, source, provider, model, updated_at)
       VALUES (@id, @festivalId, @year, @language, @tone, @body, @source, @provider, @model, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         tone=excluded.tone, body=excluded.body, source=excluded.source,
         provider=excluded.provider, model=excluded.model, updated_at=datetime('now')`,
    )
    .run({ id, ...m });

  return getOne(m.festivalId, m.year, m.language)!;
}

/* ------------------------------- AI generation ------------------------------- */

export function getAIConfig(): { provider: AIProviderId; model: string; apiKey: string | null } {
  const s = getSettings();
  const provider = s.aiProvider;
  const model = s.aiModel?.trim() || defaultModel(provider);
  const apiKey = getSecret(`ai.${provider}.key`);
  return { provider, model, apiKey };
}

const LANGUAGE_RULE: Record<MessageLanguage, string> = {
  en: "Write in warm, simple Indian English.",
  gu: "Write the entire message in Gujarati script (ગુજરાતી). Keep only the literal placeholder {name} in English letters.",
};

const TONE_RULE: Record<FestivalMessageTone, string> = {
  warm: "Tone: warm and personal, like a shopkeeper messaging a valued regular customer.",
  formal: "Tone: respectful and professional, courteous business greeting.",
  playful: "Tone: cheerful and light, a friendly festive nudge (still respectful).",
};

function buildPrompt(
  festival: string,
  language: MessageLanguage,
  tone: FestivalMessageTone,
  shop: string,
) {
  const system = [
    `You write short WhatsApp festival greetings sent by "${shop}", a family-run RO water-purifier sales and service shop in Gujarat, India.`,
    TONE_RULE[tone],
    "Rules:",
    "- 25 to 40 words, one short paragraph.",
    '- Begin by addressing the customer with the literal placeholder {name}, e.g. "Namaste {name} ji,".',
    "- Name the festival.",
    "- Include one natural line connecting the festival to clean/pure water or good health.",
    "- At most ONE emoji. No hashtags, no links, no phone numbers, no markdown.",
    `- Sign off as ${shop}.`,
    LANGUAGE_RULE[language],
    "Output only the message text.",
  ].join("\n");
  const prompt = `Festival: ${festival}`;
  return { system, prompt };
}

export async function generateFestivalMessage(input: {
  festivalId: string;
  year: number;
  language: MessageLanguage;
  tone?: FestivalMessageTone;
}): Promise<FestivalMessageRow> {
  const fest = getDb().prepare("SELECT name FROM festivals WHERE id = ?").get(input.festivalId) as
    { name: string } | undefined;
  if (!fest) throw new Error("Festival not found.");

  const settings = getSettings();
  const tone = input.tone ?? settings.aiTone;
  const { provider, model, apiKey } = getAIConfig();
  if (!apiKey) {
    throw new Error(`No API key set for ${provider}. Add one under Settings → AI assistant.`);
  }

  const { system, prompt } = buildPrompt(fest.name, input.language, tone, settings.shopName);
  const body = cleanup(await generate({ provider, model, apiKey, system, prompt }));

  return upsert({
    festivalId: input.festivalId,
    year: input.year,
    language: input.language,
    tone,
    body,
    source: "ai",
    provider,
    model,
  });
}

export async function generateAllFestivalMessages(input: {
  year: number;
  languages?: MessageLanguage[];
  tone?: FestivalMessageTone;
}): Promise<{
  generated: number;
  failed: { festival: string; language: MessageLanguage; error: string }[];
}> {
  const languages = input.languages?.length ? input.languages : getSettings().festivalLanguages;
  const festivals = getDb()
    .prepare("SELECT id, name FROM festivals WHERE active = 1 ORDER BY sort")
    .all() as { id: string; name: string }[];

  let generated = 0;
  const failed: { festival: string; language: MessageLanguage; error: string }[] = [];

  for (const f of festivals) {
    for (const language of languages) {
      try {
        await generateFestivalMessage({
          festivalId: f.id,
          year: input.year,
          language,
          ...(input.tone ? { tone: input.tone } : {}),
        });
        generated++;
      } catch (err) {
        failed.push({
          festival: f.name,
          language,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return { generated, failed };
}

/* ----------------------------- manual edit / reset ----------------------------- */

export function saveFestivalMessage(input: {
  festivalId: string;
  year: number;
  language: MessageLanguage;
  body: string;
  tone?: string;
}): FestivalMessageRow {
  return upsert({
    festivalId: input.festivalId,
    year: input.year,
    language: input.language,
    tone: input.tone ?? getSettings().aiTone,
    body: input.body,
    source: "manual",
    provider: null,
    model: null,
  });
}

export function resetFestivalMessage(input: {
  festivalId: string;
  year: number;
  language: MessageLanguage;
}): void {
  transaction(() => {
    getDb()
      .prepare("DELETE FROM festival_messages WHERE festival_id = ? AND year = ? AND language = ?")
      .run(input.festivalId, input.year, input.language);
  });
}

/** Body to actually send: the saved message, or the plain template as a fallback. */
export function resolveFestivalBody(
  festivalId: string,
  festivalName: string,
  year: number,
  language: MessageLanguage,
): { body: string; source: FestivalMessage["source"] } {
  const row = getOne(festivalId, year, language);
  if (row?.body) return { body: row.body, source: row.source };
  const s = getSettings();
  return {
    body: fillTemplate(s.festivalTemplate, {
      name: "{name}",
      festival: festivalName,
      shop: s.shopName,
    }),
    source: "template",
  };
}

function cleanup(text: string): string {
  return text
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}
