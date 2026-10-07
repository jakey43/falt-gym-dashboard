// Datumhjälpare. Datum lagras som lokala "YYYY-MM-DD"-strängar.

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

// Måndag som veckostart (svensk standard).
export function weekStart(key: string): string {
  const d = fromDateKey(key);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toDateKey(d);
}

export function isoWeek(key: string): number {
  const d = fromDateKey(key);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round((diff / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const WEEKDAYS = ["sön", "mån", "tis", "ons", "tor", "fre", "lör"];

export function formatShort(key: string): string {
  const d = fromDateKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatLong(key: string): string {
  const d = fromDateKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatWeekday(key: string): string {
  return WEEKDAYS[fromDateKey(key).getDay()];
}

export function relativeDay(key: string, today = todayKey()): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return "idag";
  if (diff === 1) return "igår";
  if (diff < 7) return `${diff} dagar sedan`;
  return formatShort(key);
}
