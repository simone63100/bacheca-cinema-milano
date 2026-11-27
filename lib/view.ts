/** Presentation helpers shared by server and client components. Every time is read in the city's zone. */
import type { BoardFilm, BoardScreening } from "./board";
import { CINEMAS } from "./cinemas";
import type { City } from "./cities";
import { distanceKm, type LatLng } from "./geo";

const TODAY_ONLY = new Set<string>(CINEMAS.filter((c) => c.todayOnly).map((c) => c.id));

export interface Clock {
  dayKey: (iso: string | Date) => string;
  hhmm: (iso: string | Date) => string;
  weekday: (iso: string | Date) => string;
  longDay: (iso: string | Date) => string;
  dayNum: (iso: string | Date) => string;
  /** "gio 19 · 20:45" */
  when: (iso: string | Date) => string;
}

const clocks = new Map<string, Clock>();

/** Formatters for one zone (cached: Intl formatters are expensive to build). */
export function clock(tz: string): Clock {
  let c = clocks.get(tz);
  if (!c) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    const time = new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const wd = new Intl.DateTimeFormat("it-IT", { timeZone: tz, weekday: "short" });
    const wdl = new Intl.DateTimeFormat("it-IT", { timeZone: tz, weekday: "long" });
    const d = new Intl.DateTimeFormat("it-IT", { timeZone: tz, day: "numeric" });
    const weekday = (iso: string | Date) => wd.format(new Date(iso)).replace(".", "");
    const dayNum = (iso: string | Date) => d.format(new Date(iso));
    const hhmm = (iso: string | Date) => time.format(new Date(iso));
    c = {
      dayKey: (iso) => key.format(new Date(iso)),
      hhmm,
      weekday,
      longDay: (iso) => wdl.format(new Date(iso)),
      dayNum,
      when: (iso) => `${weekday(iso)} ${dayNum(iso)} · ${hhmm(iso)}`,
    };
    clocks.set(tz, c);
  }
  return c;
}

export const fmtKm = (km: number) => `${km.toLocaleString("it-IT", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

export interface Place extends LatLng {
  label: string;
  radiusKm: number;
  /** true when it comes from navigator.geolocation */
  precise: boolean;
}

/** Without a position: the whole city (radius large enough to include every cinema). */
export const WHOLE_CITY_KM = 40;
export const defaultPlace = (city: City): Place => ({ label: "Tutta la città", lat: city.lat, lng: city.lng, radiusKm: WHOLE_CITY_KM, precise: false });
export const NEAR_ME_KM = 5;

export function cinemasInRadius<T extends LatLng & { id: string }>(cinemas: T[], place: Place) {
  return cinemas
    .map((c) => ({ ...c, km: distanceKm(place, c) }))
    .filter((c) => c.km <= place.radiusKm)
    .sort((a, b) => a.km - b.km);
}

export function nearScreenings(f: BoardFilm, near: Set<string>, now: Date): BoardScreening[] {
  return f.screenings.filter((s) => near.has(s.cinemaId) && new Date(s.startsAt) > now);
}

/** Urgency: only when the last screening is ≤3 days away. */
export function ribbon(rows: BoardScreening[], now: Date, tz: string): string | null {
  // today-only sources (movieplayer) cannot tell us a run is ending
  rows = rows.filter((r) => !TODAY_ONLY.has(r.cinemaId));
  if (!rows.length) return null;
  const k = clock(tz);
  const last = new Date(rows[rows.length - 1].startsAt);
  if (last.getTime() - now.getTime() > 3 * 86_400_000) return null;
  const n = new Set(rows.map((r) => k.dayKey(r.startsAt))).size;
  if (n > 1) return `ultime ${n} sere`;
  return k.dayKey(rows[0].startsAt) === k.dayKey(now) ? "solo oggi" : `ultima: ${k.weekday(rows[0].startsAt)}`;
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
      const known = x.rows.filter((r) => !TODAY_ONLY.has(r.cinemaId));
      const last = known.length ? new Date(known[known.length - 1].startsAt).getTime() : Infinity;
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

/** Screenings from 18:00 today, in the city's own evening. */
export function tonight(films: BoardFilm[], near: Set<string>, now: Date, tz: string) {
  const k = clock(tz);
  const today = k.dayKey(now);
  return films
    .map((f) => ({ f, rows: nearScreenings(f, near, now).filter((r) => k.dayKey(r.startsAt) === today && Number(k.hhmm(r.startsAt).slice(0, 2)) >= 18) }))
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

// ---- compat while the UI moves to per-city clocks (v2): Milan defaults, to be removed with the city UI
import { CITIES } from "./cities";
const MILANO = CITIES[0];
export const { dayKey, hhmm, weekday, dayNum, when } = clock(MILANO.tz);
export const QUARTIERI = MILANO.quartieri;
export const DEFAULT_PLACE: Place = { label: "Duomo", lat: 45.4642, lng: 9.19, radiusKm: 5, precise: false };
