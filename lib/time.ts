/**
 * Time in a city's own zone. Every city carries its IANA zone (lib/cities.ts); nothing here
 * assumes Milan. The rome* helpers below are kept for the Milan scrapers, whose sources are in Milan.
 */
export const ROME = "Europe/Rome";

/** Offset in minutes of `tz` from UTC at a given UTC instant. */
function offsetMinutes(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** Wall-clock time in `tz` → UTC ISO string (DST-safe: the offset is re-checked at the result). */
export function zonedToIso(tz: string, y: number, m: number, d: number, h: number, min: number): string {
  const wall = Date.UTC(y, m - 1, d, h, min);
  let utc = wall - offsetMinutes(tz, wall) * 60000;
  const again = offsetMinutes(tz, utc);
  utc = wall - again * 60000;
  return new Date(utc).toISOString();
}

/** Today's date in `tz` as {y,m,d}. */
export function todayIn(tz: string, now: Date = new Date()): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now).split("-").map(Number);
  return { y, m, d };
}

/** YYYY-MM-DD of an instant in `tz`. */
export const dateKeyIn = (tz: string, iso: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));

/** HH:MM of an instant in `tz`. */
export const timeIn = (tz: string, iso: string | Date) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** Hour 0-23 of an instant in `tz`. */
export const hourIn = (tz: string, iso: string | Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

// Milan scrapers read Milan sources
export const romeToIso = (y: number, m: number, d: number, h: number, min: number) => zonedToIso(ROME, y, m, d, h, min);
export const romeToday = (now: Date = new Date()) => todayIn(ROME, now);
export const romeDateKey = (iso: string | Date) => dateKeyIn(ROME, iso);
export const romeTime = (iso: string | Date) => timeIn(ROME, iso);

export const MONTHS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function monthFromItalian(word: string): number {
  const i = MONTHS_IT.indexOf(word.toLowerCase().trim());
  if (i < 0) throw new Error(`mese sconosciuto: ${word}`);
  return i + 1;
}

/**
 * Given a day/month without year, pick the year that puts the date closest to `ref`
 * (listings straddle New Year in late December).
 */
export function inferYear(m: number, d: number, ref: { y: number; m: number; d: number }): number {
  const candidates = [ref.y - 1, ref.y, ref.y + 1];
  const refMs = Date.UTC(ref.y, ref.m - 1, ref.d);
  return candidates.reduce((best, y) =>
    Math.abs(Date.UTC(y, m - 1, d) - refMs) < Math.abs(Date.UTC(best, m - 1, d) - refMs) ? y : best,
  );
}
