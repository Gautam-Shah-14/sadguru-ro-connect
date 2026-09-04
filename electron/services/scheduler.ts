import { daysUntil } from "../../shared/domain";
import type { MessageLanguage } from "../../shared/types";
import { getSettings } from "./settings";
import { listFestivalsForYear } from "./festivals";
import { festivalSendCount } from "./messages";
import { sendFestivalGreeting } from "./whatsapp";
import { autoSyncFestivals } from "./holidays";

const HOUR = 60 * 60 * 1000;
const SEND_HOUR = 9; // 9:00 AM local
let timer: NodeJS.Timeout | null = null;

function todayParts() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    year: now.getFullYear(),
  };
}

/** Festivals landing today that still need their automatic greeting. */
function dueTodayFestivals() {
  const { month, day, year } = todayParts();
  return listFestivalsForYear(year)
    .filter((f) => f.active && f.month === month && f.day === day)
    .filter((f) => festivalSendCount(f.id, year) === 0)
    .map((f) => ({ ...f, year }));
}

/** Festivals in the last 7 days whose greeting never went out. */
export function missedFestivals(): {
  id: string;
  name: string;
  emoji: string;
  year: number;
  daysAgo: number;
}[] {
  const year = new Date().getFullYear();
  return listFestivalsForYear(year)
    .filter((f) => f.active)
    .map((f) => {
      const iso = `${year}-${`${f.month}`.padStart(2, "0")}-${`${f.day}`.padStart(2, "0")}`;
      return { f, delta: daysUntil(iso) };
    })
    .filter(({ f, delta }) => delta < 0 && delta >= -7 && festivalSendCount(f.id, year) === 0)
    .map(({ f, delta }) => ({
      id: f.id,
      name: f.name,
      emoji: f.emoji,
      year,
      daysAgo: -delta,
    }));
}

async function tick(): Promise<void> {
  try {
    await autoSyncFestivals();
  } catch {
    /* handled inside */
  }
  try {
    const s = getSettings();
    if (!s.autoFestival) return;
    const { hour } = todayParts();
    if (hour < SEND_HOUR) return;

    const languages = (
      s.festivalLanguages.length ? s.festivalLanguages : ["en"]
    ) as MessageLanguage[];
    const primary = languages[0]!;

    for (const f of dueTodayFestivals()) {
      console.log(`[scheduler] auto-sending "${f.name}" greeting (${primary})`);
      await sendFestivalGreeting({ festivalId: f.id, year: f.year, language: primary });
    }
  } catch (err) {
    console.error("[scheduler] tick failed", err);
  }
}

export function startScheduler(): void {
  if (timer) return;
  void tick(); // catch-up on launch
  timer = setInterval(() => void tick(), HOUR);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Exposed for the self-test / a manual "run now" action. */
export async function runSchedulerTick(): Promise<void> {
  await tick();
}
