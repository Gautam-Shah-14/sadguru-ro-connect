import type {
  FestivalSyncMatch,
  FestivalSyncPreview,
  HolidayProviderId,
  HolidayProviderInfo,
} from "../../shared/types";
import { getSecret, hasSecret, setSecret } from "./secrets";
import { getSettings, setMeta, getMeta } from "./settings";
import {
  listFestivals,
  listFestivalsForYear,
  setFestivalYearDate,
  upsertFestival,
} from "./festivals";

const PROVIDERS: Record<HolidayProviderId, Omit<HolidayProviderInfo, "keyConfigured">> = {
  calendarific: {
    id: "calendarific",
    label: "Calendarific",
    keyUrl: "https://calendarific.com/account",
    note: "Free plan: 1,000 requests/day, future years supported. Recommended.",
  },
  apininjas: {
    id: "apininjas",
    label: "API Ninjas",
    keyUrl: "https://api-ninjas.com/profile",
    note: "Free plan: current year only (the year parameter is premium).",
  },
};

export function listHolidayProviders(): HolidayProviderInfo[] {
  return (Object.keys(PROVIDERS) as HolidayProviderId[]).map((id) => ({
    ...PROVIDERS[id],
    keyConfigured: hasSecret(`holiday.${id}.key`),
  }));
}

export function saveHolidayKey(provider: HolidayProviderId, key: string): HolidayProviderInfo[] {
  setSecret(`holiday.${provider}.key`, key.trim());
  return listHolidayProviders();
}

type RawHoliday = { name: string; iso: string; type: string };

async function fetchHolidays(provider: HolidayProviderId, year: number): Promise<RawHoliday[]> {
  const key = getSecret(`holiday.${provider}.key`);
  if (!key) throw new Error(`No API key set for ${PROVIDERS[provider].label}.`);

  if (provider === "calendarific") {
    const url = `https://calendarific.com/api/v2/holidays?api_key=${encodeURIComponent(
      key,
    )}&country=IN&year=${year}`;
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || json?.meta?.code !== 200) {
      throw new Error(json?.meta?.error_detail || json?.error || `Calendarific HTTP ${res.status}`);
    }
    const list = (json?.response?.holidays ?? []) as any[];
    return list
      .map((h) => ({
        name: String(h?.name ?? ""),
        iso: String(h?.date?.iso ?? "").slice(0, 10),
        type: (Array.isArray(h?.type)
          ? h.type.join(" ")
          : String(h?.primary_type ?? "")
        ).toLowerCase(),
      }))
      .filter((h) => h.name && /^\d{4}-\d{2}-\d{2}$/.test(h.iso));
  }

  const url = `https://api.api-ninjas.com/v2/holidays?country=IN&year=${year}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key } });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(json?.error || `API Ninjas HTTP ${res.status}`);
  const list = Array.isArray(json) ? json : [];
  return list
    .map((h) => ({
      name: String(h?.name ?? ""),
      iso: String(h?.date ?? "").slice(0, 10),
      type: String(h?.type ?? "").toLowerCase(),
    }))
    .filter((h) => h.name && /^\d{4}-\d{2}-\d{2}$/.test(h.iso));
}

export async function testHolidayKey(
  provider: HolidayProviderId,
  key?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (key) setSecret(`holiday.${provider}.key`, key.trim());
    const rows = await fetchHolidays(provider, new Date().getFullYear());
    return { ok: rows.length > 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* ------------------------------- name matching ------------------------------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: string[][] = [
  ["diwali", "deepavali", "diwalideepavali", "lakshmipuja"],
  ["dussehra", "dasara", "vijayadashami", "dashain"],
  ["ganeshchaturthi", "vinayakachaturthi", "vinayakachavithi"],
  ["janmashtami", "krishnajanmashtami", "gokulashtami"],
  ["rakshabandhan", "rakhi", "rakhipurnima"],
  ["ramnavami", "ramanavami", "sriramanavami"],
  ["mahashivratri", "mahashivaratri", "shivratri"],
  ["gudipadwa", "ugadi", "yugadi", "chetichand"],
  ["makarsankranti", "pongal", "uttarayan", "maghbihu"],
  ["navratri", "navaratri", "sharadanavratri"],
  ["gurunanakjayanti", "gurunanakbirthday", "gurpurab"],
  ["holi", "holidhuleti", "dhulandi"],
  ["bhaidooj", "bhaubeej", "bhaiyadooj"],
  ["dhanteras", "dhantrayodashi"],
  ["akshayatritiya", "akshaytritiya", "akhateej"],
];

function aliasSet(name: string): Set<string> {
  const n = norm(name);
  for (const group of ALIASES) {
    if (group.some((g) => n.includes(g) || g.includes(n))) return new Set(group.concat(n));
  }
  return new Set([n]);
}

function matchHoliday(festivalName: string, holidays: RawHoliday[]): RawHoliday | null {
  const fset = aliasSet(festivalName);
  const fn = norm(festivalName);
  for (const h of holidays) if (norm(h.name) === fn) return h;
  for (const h of holidays) {
    const hset = aliasSet(h.name);
    for (const a of fset) if (hset.has(a)) return h;
  }
  for (const h of holidays) {
    const hn = norm(h.name);
    if (fn.length >= 5 && (hn.includes(fn) || fn.includes(hn))) return h;
  }
  return null;
}

const EMOJI_RULES: [RegExp, string][] = [
  [/diwali|deepavali|dhanteras|lakshmi|dhantrayod/i, "🪔"],
  [/holi/i, "🎨"],
  [/raksha|rakhi/i, "🧵"],
  [/ganesh|vinayaka/i, "🐘"],
  [/janmashtami|krishna/i, "🪈"],
  [/navratri|navaratri|durga/i, "🪔"],
  [/dussehra|dasara|vijayadashami|ram ?navami|ramanavami/i, "🏹"],
  [/christmas/i, "🎄"],
  [/new year/i, "🎉"],
  [/eid|ramadan|ramzan|bakr/i, "🌙"],
  [/guru ?nanak|gurpurab|baisakhi|vaisakhi/i, "🙏"],
  [/republic|independence|gandhi/i, "🇮🇳"],
  [/pongal|makar|sankranti|lohri|bihu|uttarayan/i, "🪁"],
  [/shivratri|shivaratri/i, "🔱"],
  [/bhai ?dooj|bhaubeej/i, "🎁"],
  [/onam/i, "🌸"],
  [/ugadi|gudi ?padwa|baisakhi/i, "🌿"],
  [/mahavir|buddha|purnima/i, "☸️"],
];

function emojiFor(name: string): string {
  for (const [re, e] of EMOJI_RULES) if (re.test(name)) return e;
  return "🎉";
}

// Holidays worth adding to the festival list automatically.
function isFestivalLike(h: RawHoliday): boolean {
  const t = h.type;
  if (/season|day of|awareness|world |international |united nations/i.test(h.name)) return false;
  return (
    /hindu|religious|muslim|islam|christian|sikh|buddh|jain|national holiday|gazetted|public holiday|observance|festival/i.test(
      t,
    ) ||
    /jayanti|puja|pooja|utsav|parva|chaturthi|ekadashi|purnima|amavasya|navratri|mela/i.test(h.name)
  );
}

export async function previewFestivalSync(year: number): Promise<FestivalSyncPreview> {
  const provider = getSettings().holidayProvider;
  const holidays = await fetchHolidays(provider, year);
  const festivals = listFestivalsForYear(year);

  const matches: FestivalSyncMatch[] = [];
  const unmatchedFestivals: { festivalId: string; name: string }[] = [];
  const used = new Set<string>();

  for (const f of festivals) {
    const h = matchHoliday(f.name, holidays);
    if (!h) {
      unmatchedFestivals.push({ festivalId: f.id, name: f.name });
      continue;
    }
    used.add(h.name);
    const currentIso = `${year}-${`${f.month}`.padStart(2, "0")}-${`${f.day}`.padStart(2, "0")}`;
    matches.push({
      festivalId: f.id,
      festivalName: f.name,
      currentIso,
      newIso: h.iso,
      holidayName: h.name,
      changed: currentIso !== h.iso,
    });
  }

  const unmatchedHolidays = holidays
    .filter((h) => !used.has(h.name) && isFestivalLike(h))
    .map((h) => ({ name: h.name, iso: h.iso }));

  return { year, provider, matches, unmatchedFestivals, unmatchedHolidays };
}

export function applyFestivalSync(
  year: number,
  input: {
    updates: { festivalId: string; iso: string }[];
    additions?: { name: string; iso: string }[];
  },
  provider: HolidayProviderId,
): { updated: number; added: number } {
  let updated = 0;
  for (const e of input.updates) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.iso);
    if (!m) continue;
    setFestivalYearDate(e.festivalId, year, Number(m[2]), Number(m[3]), provider);
    updated++;
  }

  let added = 0;
  const existingNames = new Set(listFestivals().map((f) => norm(f.name)));
  for (const a of input.additions ?? []) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.iso);
    if (!m || existingNames.has(norm(a.name))) continue;
    const f = upsertFestival({
      name: a.name,
      emoji: emojiFor(a.name),
      month: Number(m[2]),
      day: Number(m[3]),
      active: true,
    });
    setFestivalYearDate(f.id, year, Number(m[2]), Number(m[3]), provider);
    existingNames.add(norm(a.name));
    added++;
  }
  return { updated, added };
}

/**
 * Keeps the festival list current with the online calendar. Runs on launch and
 * at most once a day. No-op without a configured holiday API key or when the
 * user has switched auto-sync off.
 */
export async function autoSyncFestivals(): Promise<{ updated: number; added: number } | null> {
  const s = getSettings();
  if (!s.autoSyncFestivals) return null;
  if (!hasSecret(`holiday.${s.holidayProvider}.key`)) return null;

  const today = new Date().toISOString().slice(0, 10);
  if (getMeta("festivalsSyncedOn") === today) return null;

  const thisYear = new Date().getFullYear();
  const totals = { updated: 0, added: 0 };
  for (const year of [thisYear, thisYear + 1]) {
    try {
      const p = await previewFestivalSync(year);
      const r = applyFestivalSync(
        year,
        {
          updates: p.matches
            .filter((m) => m.changed)
            .map((m) => ({ festivalId: m.festivalId, iso: m.newIso })),
          additions: p.unmatchedHolidays,
        },
        s.holidayProvider,
      );
      totals.updated += r.updated;
      totals.added += r.added;
    } catch (err) {
      console.error(`[festival-sync] ${year} failed`, err);
    }
  }
  setMeta("festivalsSyncedOn", today);
  console.log(`[festival-sync] updated ${totals.updated}, added ${totals.added}`);
  return totals;
}
