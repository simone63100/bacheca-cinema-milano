import { CINEMAS } from "./cinemas";
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
  screenings: BoardScreening[];
}

export interface Board {
  films: BoardFilm[];
  cinemas: typeof CINEMAS;
  freshness: FreshnessState;
  generatedAt: string;
}

const HORIZON_DAYS = 21;

export async function loadBoard(now = new Date()): Promise<Board> {
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
    }>(
      `SELECT f.id, f.tmdb_id, f.title, f.original_title, f.director, f.year, f.runtime, f.poster, f.trailer, f.tags
       FROM films f WHERE EXISTS (SELECT 1 FROM screenings s WHERE s.film_id = f.id AND s.starts_at > $1 AND s.starts_at < $2)`,
      [now.toISOString(), until],
    ),
    q<{ film_id: string; cinema_id: string; starts_at: string; vo: boolean; special: boolean; url: string | null }>(
      `SELECT film_id, cinema_id, starts_at, vo, special, url FROM screenings
       WHERE starts_at > $1 AND starts_at < $2 ORDER BY starts_at`,
      [now.toISOString(), until],
    ),
    q<{ id: string; finished_at: string }>("SELECT id, finished_at FROM runs WHERE ok ORDER BY finished_at DESC LIMIT 1"),
  ]);
  const byFilm = new Map<number, BoardScreening[]>();
  for (const s of screenings) {
    const id = Number(s.film_id);
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
        title: f.title,
        originalTitle: f.original_title,
        director: f.director,
        year: f.year,
        runtime: f.runtime,
        poster: f.poster,
        trailer: f.trailer,
        tags: f.tags,
        screenings: byFilm.get(Number(f.id)) ?? [],
      }))
      .filter((f) => f.screenings.length > 0),
    cinemas: CINEMAS,
    freshness: freshness(last[0] ? { id: Number(last[0].id), finishedAt: new Date(last[0].finished_at).toISOString() } : null, now, null),
    generatedAt: now.toISOString(),
  };
}

export async function loadFilm(id: number, now = new Date()): Promise<BoardFilm | null> {
  const board = await loadBoard(now);
  return board.films.find((f) => f.id === id) ?? null;
}
