const TZ = "Europe/Rome";

/** Offset in minutes of Europe/Rome from UTC at a given UTC instant. */
function romeOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
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

/** Wall-clock time in Milan → UTC ISO string. */
export function romeToIso(y: number, m: number, d: number, h: number, min: number): string {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const off = romeOffsetMinutes(guess - 60 * 60000);
  return new Date(guess - off * 60000).toISOString();
}

/** Today's date in Milan as {y,m,d}. */
export function romeToday(now: Date = new Date()): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now); // YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** YYYY-MM-DD of an instant, in Milan. */
export function romeDateKey(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

/** HH:MM of an instant, in Milan. */
export function romeTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

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
