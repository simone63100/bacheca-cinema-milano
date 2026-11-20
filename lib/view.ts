/** Presentation helpers shared by server and client components. */
import type { BoardFilm, BoardScreening } from "./board";
import { distanceKm, type LatLng } from "./geo";

const TZ = "Europe/Rome";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const wdFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "short" });
const dFmt = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, day: "numeric" });

export const dayKey = (iso: string | Date) => dayKeyFmt.format(new Date(iso));
export const hhmm = (iso: string) => timeFmt.format(new Date(iso));
export const weekday = (iso: string | Date) => wdFmt.format(new Date(iso)).replace(".", "");
export const dayNum = (iso: string | Date) => dFmt.format(new Date(iso));
/** "gio 19 · 20:45" */
export const when = (iso: string) => `${weekday(iso)} ${dayNum(iso)} · ${hhmm(iso)}`;

export const fmtKm = (km: number) => `${km.toLocaleString("it-IT", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

export interface Place extends LatLng {
  label: string;
  radiusKm: number;
  /** true when it comes from navigator.geolocation */
  precise: boolean;
}

export const DEFAULT_PLACE: Place = { label: "Duomo", lat: 45.4642, lng: 9.19, radiusKm: 5, precise: false };

/** Quartieri for the no-geolocation fallback: resolved locally, nothing is sent anywhere. */
export const QUARTIERI: { label: string; lat: number; lng: number }[] = [
  { label: "Duomo", lat: 45.4642, lng: 9.19 },
  { label: "Brera", lat: 45.4719, lng: 9.1879 },
  { label: "Porta Venezia", lat: 45.4744, lng: 9.2052 },
  { label: "Isola", lat: 45.4876, lng: 9.1897 },
  { label: "NoLo", lat: 45.4964, lng: 9.2186 },
  { label: "Città Studi", lat: 45.4783, lng: 9.2275 },
  { label: "Porta Romana", lat: 45.4513, lng: 9.2032 },
  { label: "Navigli", lat: 45.4522, lng: 9.1772 },
  { label: "Porta Genova / Tortona", lat: 45.4535, lng: 9.1665 },
  { label: "Sempione / Arco della Pace", lat: 45.4757, lng: 9.1725 },
  { label: "CityLife / Fiera", lat: 45.4775, lng: 9.1555 },
  { label: "Bicocca / Niguarda", lat: 45.5148, lng: 9.2113 },
  { label: "Lambrate", lat: 45.4846, lng: 9.2398 },
  { label: "Corvetto", lat: 45.4405, lng: 9.2229 },
];

export function cinemasInRadius<T extends LatLng & { id: string }>(cinemas: T[], place: Place) {
  return cinemas
    .map((c) => ({ ...c, km: distanceKm(place, c) }))
    .filter((c) => c.km <= place.radiusKm)
    .sort((a, b) => a.km - b.km);
}

export function nearScreenings(f: BoardFilm, near: Set<string>, now: Date): BoardScreening[] {
  return f.screenings.filter((s) => near.has(s.cinemaId) && new Date(s.startsAt) > now);
}

/** Distinct evenings left in the radius. */
export function eveningsLeft(rows: BoardScreening[]): number {
  return new Set(rows.map((r) => dayKey(r.startsAt))).size;
}

/** Urgency ribbon: only when the last screening is ≤3 days away. */
export function ribbon(rows: BoardScreening[], now: Date, prefix?: string): string | null {
  if (!rows.length) return null;
  const last = new Date(rows[rows.length - 1].startsAt);
  if (last.getTime() - now.getTime() > 3 * 86_400_000) return null;
  const n = eveningsLeft(rows);
  const today = dayKey(now);
  const core =
    n === 1 ? (dayKey(rows[0].startsAt) === today ? "solo oggi" : `ultima: ${weekday(rows[0].startsAt)}`) : `ultime ${n} sere`;
  return prefix ? `${prefix} · ${core}` : core;
}

/**
 * "Per te" without a Letterboxd account: films that are hard to catch first
 * (few screenings, ending soon, special, v.o.), then the rest by next screening.
 */
export function rankForYou(films: BoardFilm[], near: Set<string>, now: Date) {
  return films
    .map((f) => ({ f, rows: nearScreenings(f, near, now) }))
    .filter((x) => x.rows.length > 0)
    .map((x) => {
      const last = new Date(x.rows[x.rows.length - 1].startsAt).getTime();
      const daysLeft = (last - now.getTime()) / 86_400_000;
      let score = 0;
      if (x.rows.length <= 2) score += 3;
      if (daysLeft <= 3) score += 2;
      if (x.rows.some((r) => r.special)) score += 2;
      if (x.f.tags.includes("classico") || x.f.tags.includes("restauro")) score += 1.5;
      if (x.rows.some((r) => r.vo)) score += 1;
      if (x.f.poster) score += 1;
      return { ...x, score };
    })
    .sort((a, b) => b.score - a.score || a.rows[0].startsAt.localeCompare(b.rows[0].startsAt));
}

export function tonight(films: BoardFilm[], near: Set<string>, now: Date) {
  const today = dayKey(now);
  return films
    .map((f) => ({ f, rows: nearScreenings(f, near, now).filter((r) => dayKey(r.startsAt) === today && Number(hhmm(r.startsAt).slice(0, 2)) >= 18) }))
    .filter((x) => x.rows.length > 0)
    .sort((a, b) => a.rows[0].startsAt.localeCompare(b.rows[0].startsAt));
}

export function letterboxdUrl(f: Pick<BoardFilm, "tmdbId" | "title">) {
  return f.tmdbId ? `https://letterboxd.com/tmdb/${f.tmdbId}/` : `https://letterboxd.com/search/films/${encodeURIComponent(f.title)}/`;
}

export function trailerUrl(f: Pick<BoardFilm, "trailer" | "title" | "year">) {
  return f.trailer ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${f.title} ${f.year ?? ""} trailer`)}`;
}

export function calendarUrl(f: Pick<BoardFilm, "title" | "runtime">, s: BoardScreening, cinemaName: string) {
  const start = new Date(s.startsAt);
  const end = new Date(start.getTime() + (f.runtime ?? 120) * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({ action: "TEMPLATE", text: `${f.title} · ${cinemaName}`, dates: `${fmt(start)}/${fmt(end)}`, location: cinemaName });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function metaLine(f: Pick<BoardFilm, "director" | "year" | "runtime">, vo: boolean) {
  return [f.director, f.year, f.runtime ? `${f.runtime}′` : null, vo ? "v.o." : null].filter(Boolean).join(" · ");
}
