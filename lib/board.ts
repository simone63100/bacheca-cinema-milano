import { cache } from "react";
import { cinemasIn } from "./cinemas";
import { DEFAULT_CITY, cityById, type City, type CityId } from "./cities";
import { q } from "./db";
import { freshness, type FreshnessState } from "./freshness";

export interface BoardScreening {
  cinemaId: string;
  startsAt: string;
  vo: boolean;
  special: boolean;
  url: string | null;
}

export interface BoardFilm {
  id: number;
  tmdbId: number | null;
  title: string;
  originalTitle: string | null;
  director: string | null;
  year: number | null;
  runtime: number | null;
  poster: string | null;
  trailer: string | null;
  tags: string[];
  /** Glow colour from the poster (pipeline), null → interface orange. */
  accent: string | null;
  screenings: BoardScreening[];
}

export interface Board {
  films: BoardFilm[];
  city: City;
  cinemas: ReturnType<typeof cinemasIn>;
  freshness: FreshnessState;
  generatedAt: string;
}

const HORIZON_DAYS = 21;

const hallTitle = (counts?: Map<string, number>) => (counts ? [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined);

export async function loadBoard(cityId: CityId = DEFAULT_CITY, now = new Date()): Promise<Board> {
  const city = cityById(cityId);
  const until = new Date(now.getTime() + HORIZON_DAYS * 86_400_000).toISOString();
  const [films, screenings, last] = await Promise.all([
    q<{
      id: string;
      tmdb_id: number | null;
      title: string;
      original_title: string | null;
      director: string | null;
      year: number | null;
      runtime: number | null;
      poster: string | null;
      trailer: string | null;
      tags: string[];
      accent: string | null;
      poster_es: string | null;
    }>(
      `SELECT f.id, f.tmdb_id, f.title, f.original_title, f.director, f.year, f.runtime, f.poster, f.trailer, f.tags, f.accent, f.poster_es
       FROM films f WHERE EXISTS (SELECT 1 FROM screenings s JOIN cinemas c ON c.id = s.cinema_id
         WHERE s.film_id = f.id AND s.starts_at > $1 AND s.starts_at < $2 AND c.city = $3)`,
      [now.toISOString(), until, city.id],
    ),
    q<{ film_id: string; cinema_id: string; starts_at: string; vo: boolean; special: boolean; url: string | null; raw_title: string }>(
      `SELECT s.film_id, s.cinema_id, s.starts_at, s.vo, s.special, s.url, s.raw_title FROM screenings s JOIN cinemas c ON c.id = s.cinema_id
       WHERE s.starts_at > $1 AND s.starts_at < $2 AND c.city = $3 ORDER BY s.starts_at`,
      [now.toISOString(), until, city.id],
    ),
    q<{ id: string; finished_at: string }>("SELECT id, finished_at FROM runs WHERE ok AND city = $1 ORDER BY finished_at DESC LIMIT 1", [city.id]),
  ]);
  const byFilm = new Map<number, BoardScreening[]>();
  // printed titles per film, most frequent wins (for cities that show the hall's title)
  const printed = new Map<number, Map<string, number>>();
  for (const s of screenings) {
    const id = Number(s.film_id);
    const counts = printed.get(id) ?? new Map<string, number>();
    counts.set(s.raw_title, (counts.get(s.raw_title) ?? 0) + 1);
    printed.set(id, counts);
    byFilm.set(id, [
      ...(byFilm.get(id) ?? []),
      { cinemaId: s.cinema_id, startsAt: new Date(s.starts_at).toISOString(), vo: s.vo, special: s.special, url: s.url },
    ]);
  }
  return {
    films: films
      .map((f) => ({
        id: Number(f.id),
        tmdbId: f.tmdb_id,
        title: city.titles === "sala" ? hallTitle(printed.get(Number(f.id))) ?? f.title : f.title,
        originalTitle: f.original_title,
        director: f.director,
        year: f.year,
        runtime: f.runtime,
        poster: (city.tmdbLang === "es-CO" && f.poster_es) || f.poster,
        trailer: f.trailer,
        tags: f.tags,
        accent: f.accent,
        screenings: byFilm.get(Number(f.id)) ?? [],
      }))
      .filter((f) => f.screenings.length > 0),
    city,
    cinemas: cinemasIn(city.id),
    freshness: freshness(last[0] ? { id: Number(last[0].id), finishedAt: new Date(last[0].finished_at).toISOString() } : null, now, null, city),
    generatedAt: now.toISOString(),
  };
}

/** One film with its upcoming screenings; React cache() dedupes metadata + page in one request. */
export const loadFilm = cache(async (id: number): Promise<BoardFilm | null> => {
  const now = new Date().toISOString();
  const [films, screenings] = await Promise.all([
    q<{ id: string; tmdb_id: number | null; title: string; original_title: string | null; director: string | null; year: number | null; runtime: number | null; poster: string | null; trailer: string | null; tags: string[]; accent: string | null }>(
      "SELECT id, tmdb_id, title, original_title, director, year, runtime, poster, trailer, tags, accent FROM films WHERE id = $1",
      [id],
    ),
    q<{ cinema_id: string; starts_at: string; vo: boolean; special: boolean; url: string | null }>(
      "SELECT cinema_id, starts_at, vo, special, url FROM screenings WHERE film_id = $1 AND starts_at > $2 ORDER BY starts_at",
      [id, now],
    ),
  ]);
  const f = films[0];
  if (!f || !screenings.length) return null;
  return {
    id: Number(f.id),
    tmdbId: f.tmdb_id,
    title: f.title,
    originalTitle: f.original_title,
    director: f.director,
    year: f.year,
    runtime: f.runtime,
    poster: f.poster,
    trailer: f.trailer,
    tags: f.tags,
    accent: f.accent,
    screenings: screenings.map((s) => ({ cinemaId: s.cinema_id, startsAt: new Date(s.starts_at).toISOString(), vo: s.vo, special: s.special, url: s.url })),
  };
});
