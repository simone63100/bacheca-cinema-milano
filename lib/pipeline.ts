/**
 * Daily pipeline (Neon Function `daily`, schedule trigger 1×/day):
 * scrape 13 cinemas → normalise → TMDB match → upsert → refresh Letterboxd users →
 * FOMO rules → mails → freshness guard.
 */
import { CINEMAS } from "./cinemas";
import { q } from "./db";
import { evaluateUser, type FomoFilm, type FomoScreening, type FomoUser } from "./fomo";
import { freshness } from "./freshness";
import { matchTitle, normalizeTitle } from "./match";
import { posterUrl, tmdb } from "./tmdb";
import type { CinemaId, Screening } from "./types";

export interface ScrapedCinema {
  cinemaId: CinemaId;
  rows: Screening[];
  error: string | null;
}

export const MIN_CINEMAS_OK = 11;

export function tagsFor(rows: Screening[], year: number | null, now: Date): string[] {
  const tags = new Set<string>();
  if (rows.some((r) => r.vo)) tags.add("vo");
  const age = year ? now.getUTCFullYear() - year : null;
  if (age !== null && age <= 1) tags.add("prima-visione");
  if (age !== null && age >= 10) tags.add("classico");
  if (rows.some((r) => r.special) && age !== null && age >= 10) tags.add("restauro");
  if (rows.some((r) => r.special)) tags.add("evento");
  return [...tags];
}

async function resolveFilm(key: string, sample: Screening, rows: Screening[], now: Date): Promise<number> {
  const cached = await q<{ tmdb_id: number | null }>("SELECT tmdb_id FROM title_matches WHERE title_key = $1", [key]);
  let tmdbId = cached[0]?.tmdb_id ?? null;
  if (!cached.length && process.env.TMDB_TOKEN) {
    const m = await matchTitle({ title: sample.title, year: sample.year, director: sample.director, now });
    tmdbId = m.tmdbId;
    await q("INSERT INTO title_matches (title_key, tmdb_id, method) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [key, tmdbId, m.method]);
  }

  if (tmdbId) {
    const existing = await q<{ id: number }>("SELECT id FROM films WHERE tmdb_id = $1", [tmdbId]);
    if (existing.length) {
      await q("UPDATE films SET tags = (SELECT array(SELECT DISTINCT unnest(tags || $2::text[]))) WHERE id = $1", [existing[0].id, tagsFor(rows, null, now)]);
      return existing[0].id;
    }
    const d = await tmdb.details(tmdbId);
    const year = d.release_date ? Number(d.release_date.slice(0, 4)) : null;
    const ins = await q<{ id: number }>(
      `INSERT INTO films (tmdb_id, title, original_title, director, year, runtime, poster, trailer, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (tmdb_id) DO UPDATE SET title = EXCLUDED.title RETURNING id`,
      [tmdbId, d.title, d.original_title, d.directors.join(", ") || null, year, d.runtime ?? null, posterUrl(d.poster_path) ?? rows.find((r) => r.poster)?.poster ?? null, d.trailer ?? null, tagsFor(rows, year, now)],
    );
    return ins[0].id;
  }

  const ins = await q<{ id: number }>(
    `INSERT INTO films (title, director, year, tags, title_key, poster) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (title_key) DO UPDATE SET tags = EXCLUDED.tags, poster = COALESCE(films.poster, EXCLUDED.poster) RETURNING id`,
    [sample.title, sample.director ?? null, sample.year ?? null, tagsFor(rows, sample.year ?? null, now), key, rows.find((r) => r.poster)?.poster ?? null],
  );
  return ins[0].id;
}

export async function storeScreenings(scraped: ScrapedCinema[], now: Date, runStart: Date) {
  const all = scraped.flatMap((s) => s.rows);
  const groups = new Map<string, Screening[]>();
  for (const r of all) {
    const k = normalizeTitle(r.title);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [key, rows] of groups) {
    const filmId = await resolveFilm(key, rows.find((r) => r.director || r.year) ?? rows[0], rows, now);
    // one statement per film; duplicates within the batch would trip ON CONFLICT, so dedupe first
    const uniq = [...new Map(rows.map((r) => [`${r.cinemaId}|${r.startsAt}`, r])).values()];
    await q(
      `INSERT INTO screenings (film_id, cinema_id, starts_at, vo, special, url, raw_title, seen_at)
       SELECT $1, c, s::timestamptz, v, sp, u, t, now()
       FROM unnest($2::text[], $3::text[], $4::bool[], $5::bool[], $6::text[], $7::text[]) AS x(c, s, v, sp, u, t)
       ON CONFLICT (cinema_id, starts_at, film_id) DO UPDATE SET vo = EXCLUDED.vo, special = EXCLUDED.special, url = EXCLUDED.url, seen_at = now()`,
      [
        filmId,
        uniq.map((r) => r.cinemaId),
        uniq.map((r) => r.startsAt),
        uniq.map((r) => r.vo),
        uniq.map((r) => r.special),
        uniq.map((r) => r.url),
        uniq.map((r) => r.title),
      ],
    );
  }
  // cancelled screenings: future rows of a cinema scraped OK this run but not seen again
  const okIds = scraped.filter((s) => !s.error && s.rows.length).map((s) => s.cinemaId);
  if (okIds.length) {
    await q("DELETE FROM screenings WHERE cinema_id = ANY($1) AND starts_at > $2 AND seen_at < $3", [okIds, now.toISOString(), runStart.toISOString()]);
  }
}

export async function runFomo(now: Date, send: (userId: string, hits: ReturnType<typeof evaluateUser>, films: FomoFilm[]) => Promise<void>) {
  const users = await q<{ id: string; lat: number | null; lng: number | null; radius_km: number }>(
    "SELECT id, lat, lng, radius_km FROM users WHERE lat IS NOT NULL AND lng IS NOT NULL",
  );
  if (!users.length) return { users: 0, mails: 0 };
  const films = (
    await q<{ id: number; tmdb_id: number | null; title: string; year: number | null; tags: string[] }>(
      "SELECT f.id, f.tmdb_id, f.title, f.year, f.tags FROM films f WHERE EXISTS (SELECT 1 FROM screenings s WHERE s.film_id = f.id AND s.starts_at > $1)",
      [now.toISOString()],
    )
  ).map<FomoFilm>((f) => ({ filmId: f.id, tmdbId: f.tmdb_id, title: f.title, rerun: (f.year ?? now.getUTCFullYear()) < now.getUTCFullYear() - 1 || f.tags.includes("restauro") }));
  const screenings = (
    await q<{ film_id: number; cinema_id: string; starts_at: string; special: boolean }>(
      "SELECT film_id, cinema_id, starts_at, special FROM screenings WHERE starts_at > $1",
      [now.toISOString()],
    )
  ).map<FomoScreening>((s) => ({ filmId: s.film_id, tmdbId: null, cinemaId: s.cinema_id, startsAt: new Date(s.starts_at).toISOString(), special: s.special }));

  let mails = 0;
  for (const u of users) {
    const lists = await q<{ tmdb_id: number; kind: "watchlist" | "seen" | "favorite"; stars: string | null }>(
      "SELECT tmdb_id, kind, stars FROM user_films WHERE user_id = $1",
      [u.id],
    );
    const sent = await q<{ film_id: number; rule: string; sent_at: string }>("SELECT film_id, rule, sent_at FROM notifications WHERE user_id = $1", [u.id]);
    const fu: FomoUser = {
      id: u.id,
      lat: u.lat!,
      lng: u.lng!,
      radiusKm: u.radius_km,
      lists: lists.map((l) => ({ tmdbId: l.tmdb_id, kind: l.kind, stars: l.stars == null ? null : Number(l.stars) })),
      notified: new Set(sent.map((s) => `${s.film_id}|${s.rule}`)),
      lastMailAt: sent.map((s) => new Date(s.sent_at).toISOString()).sort().at(-1) ?? null,
    };
    const hits = evaluateUser(fu, films, screenings, CINEMAS, now);
    if (!hits.length) continue;
    try {
      await send(u.id, hits, films);
    } catch (e) {
      // one bad address must not stop the others; no address in the log
      console.error(`fomo: invio fallito per un utente: ${(e as Error).message}`);
      continue;
    }
    for (const h of hits) {
      await q("INSERT INTO notifications (user_id, film_id, rule, sent_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [u.id, h.filmId, h.rule, now.toISOString()]);
    }
    mails++;
  }
  return { users: users.length, mails };
}

/** `alert` returns true only when the message actually went out. */
export async function checkFreshness(now: Date, alert: (text: string) => Promise<boolean>) {
  const last = await q<{ id: number; finished_at: string }>("SELECT id, finished_at FROM runs WHERE ok ORDER BY finished_at DESC LIMIT 1");
  const lastOk = last[0] ? { id: Number(last[0].id), finishedAt: new Date(last[0].finished_at).toISOString() } : null;
  const alerted = lastOk
    ? await q<{ since_run: number }>("SELECT since_run FROM alerts WHERE kind = 'stale' AND since_run = $1", [lastOk.id])
    : await q<{ since_run: number }>("SELECT since_run FROM alerts WHERE kind = 'stale' AND since_run = 0");
  const state = freshness(lastOk, now, alerted.length ? Number(alerted[0].since_run) : null);
  if (state.alertAdmin) {
    const sent = await alert(`Bijoux: ultimo aggiornamento riuscito ${state.label}. Il sito mostra il banner "${state.banner}".`);
    if (sent) await q("INSERT INTO alerts (kind, since_run) VALUES ('stale', $1) ON CONFLICT DO NOTHING", [lastOk?.id ?? 0]);
  }
  return state;
}

export async function runDaily(opts: {
  now?: Date;
  scraped: ScrapedCinema[];
  sendFomo?: Parameters<typeof runFomo>[1];
  alertAdmin?: (text: string) => Promise<boolean>;
  refreshLetterboxd?: (now: Date) => Promise<void>;
}) {
  const now = opts.now ?? new Date();
  // run start from the DB clock: seen_at is written with the DB's now(), so both sides agree
  const [{ id: runId, started_at }] = await q<{ id: number; started_at: string }>("INSERT INTO runs DEFAULT VALUES RETURNING id, started_at");
  const runStart = new Date(started_at);
  const perCinema = Object.fromEntries(opts.scraped.map((s) => [s.cinemaId, s.error ? { n: 0, error: s.error } : { n: s.rows.length }]));
  const okCount = opts.scraped.filter((s) => !s.error && s.rows.length > 0).length;
  try {
    await storeScreenings(opts.scraped, now, runStart);
    if (opts.refreshLetterboxd) await opts.refreshLetterboxd(now);
    const fomo = opts.sendFomo ? await runFomo(now, opts.sendFomo) : null;
    const ok = okCount >= MIN_CINEMAS_OK;
    await q("UPDATE runs SET finished_at = now(), ok = $2, per_cinema = $3 WHERE id = $1", [runId, ok, JSON.stringify({ ...perCinema, _fomo: fomo })]);
  } catch (e) {
    await q("UPDATE runs SET finished_at = now(), ok = false, per_cinema = $2, error = $3 WHERE id = $1", [runId, JSON.stringify(perCinema), String((e as Error).stack ?? e)]);
    throw e;
  } finally {
    if (opts.alertAdmin) await checkFreshness(new Date(), opts.alertAdmin);
  }
  return { runId, okCount };
}
