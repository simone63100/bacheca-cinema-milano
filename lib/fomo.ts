/**
 * FOMO rules (SPEC "Mail solo FOMO"). Pure functions: the pipeline loads data, this decides.
 *
 * 1. watchlist_last — a watchlist film whose LAST screening within the user's radius is ≤3 days
 *    away; if the film is a re-run (not a first release) → as soon as it is detected.
 * 2. loved_special  — a film seen with ≥4★ or a favourite, as soon as detected, ONLY when
 *    the screening is a restoration or special screening.
 * 3. rare_event     — a film on any of the user's lists with ≤2 screenings in total, as soon as detected.
 *
 * Each (user, film, rule) is notified once. At most one mail per user per day; none if nothing matches.
 */
import { distanceKm, type LatLng } from "./geo";

export type Rule = "watchlist_last" | "loved_special" | "rare_event";

export interface FomoScreening {
  filmId: number;
  tmdbId: number | null;
  cinemaId: string;
  startsAt: string;
  special: boolean;
}

export interface FomoFilm {
  filmId: number;
  tmdbId: number | null;
  title: string;
  /** true when the film is not a first release (classic, restoration, re-run). */
  rerun: boolean;
}

export interface UserList {
  tmdbId: number;
  kind: "watchlist" | "seen" | "favorite";
  stars?: number | null;
}

export interface FomoUser extends LatLng {
  id: string;
  radiusKm: number;
  lists: UserList[];
  /** Already sent: `${filmId}|${rule}`. */
  notified: Set<string>;
  /** Last mail sent (any rule), ISO. */
  lastMailAt?: string | null;
}

export interface FomoHit {
  filmId: number;
  rule: Rule;
  /** Screenings in radius, future only, sorted. */
  screenings: FomoScreening[];
}

const DAY = 86_400_000;

export function sameRomeDay(a: Date, b: Date): boolean {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" });
  return f.format(a) === f.format(b);
}

export function evaluateUser(
  user: FomoUser,
  films: FomoFilm[],
  screenings: FomoScreening[],
  cinemas: (LatLng & { id: string; todayOnly?: boolean })[],
  now: Date,
): FomoHit[] {
  const partial = new Set(cinemas.filter((c) => c.todayOnly).map((c) => c.id));
  if (user.lastMailAt && sameRomeDay(new Date(user.lastMailAt), now)) return [];

  const inRadius = new Set(cinemas.filter((c) => distanceKm(user, c) <= user.radiusKm).map((c) => c.id));
  const future = screenings.filter((s) => new Date(s.startsAt) > now);
  const byFilm = new Map<number, FomoScreening[]>();
  for (const s of future) {
    const arr = byFilm.get(s.filmId) ?? [];
    arr.push(s);
    byFilm.set(s.filmId, arr);
  }

  const lists = new Map<number, UserList[]>();
  for (const l of user.lists) lists.set(l.tmdbId, [...(lists.get(l.tmdbId) ?? []), l]);

  const hits: FomoHit[] = [];
  for (const film of films) {
    if (film.tmdbId == null) continue;
    const mine = lists.get(film.tmdbId);
    if (!mine) continue;
    const all = (byFilm.get(film.filmId) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const near = all.filter((s) => inRadius.has(s.cinemaId));
    if (near.length === 0) continue;

    const already = (rule: Rule) => user.notified.has(`${film.filmId}|${rule}`);
    const push = (rule: Rule, rows: FomoScreening[]) => {
      if (!already(rule)) hits.push({ filmId: film.filmId, rule, screenings: rows });
    };

    const onWatchlist = mine.some((l) => l.kind === "watchlist");
    const loved = mine.some((l) => l.kind === "favorite" || (l.kind === "seen" && (l.stars ?? 0) >= 4));

    if (onWatchlist) {
      // a source that only lists today cannot tell us a run is ending
      const known = near.filter((s) => !partial.has(s.cinemaId));
      const last = known[known.length - 1];
      const ending = !!last && new Date(last.startsAt).getTime() - now.getTime() <= 3 * DAY;
      if (film.rerun || ending) push("watchlist_last", near);
    }
    if (loved) {
      const special = near.filter((s) => s.special);
      if (special.length > 0) push("loved_special", special);
    }
    if (all.length <= 2) push("rare_event", near);
  }
  return hits;
}

/** One mail per user: group hits; empty → no mail. */
export function planMail(hits: FomoHit[]): { send: boolean; hits: FomoHit[] } {
  return { send: hits.length > 0, hits };
}
