import { q } from "./db";
import { likelyMatches, parseFilmTmdbId, readProfile, type LbEntry, type ScreeningFilm } from "./letterboxd";
import { normalizeTitle } from "./match";

export async function saveEntries(userId: string, entries: LbEntry[], kinds: LbEntry["kind"][]) {
  if (!kinds.length) return;
  await q("DELETE FROM lb_entries WHERE user_id = $1 AND kind = ANY($2)", [userId, kinds]);
  const uniq = [...new Map(entries.map((e) => [`${e.kind}|${e.name}|${e.year ?? 0}`, e])).values()];
  if (!uniq.length) return;
  await q(
    `INSERT INTO lb_entries (user_id, kind, name, year, slug, stars)
     SELECT $1, k, n, y, s, st FROM unnest($2::text[], $3::text[], $4::int[], $5::text[], $6::numeric[]) AS x(k, n, y, s, st)
     ON CONFLICT DO NOTHING`,
    [userId, uniq.map((e) => e.kind), uniq.map((e) => e.name), uniq.map((e) => e.year ?? 0), uniq.map((e) => e.slug), uniq.map((e) => e.stars)],
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turns stored entries into user_films for the films currently in cinemas. */
export async function resolveUser(userId: string, films: ScreeningFilm[], opts: { fetchImpl?: typeof fetch; delayMs?: number } = {}) {
  const rows = await q<{ kind: LbEntry["kind"]; name: string; year: number; slug: string | null; stars: string | null }>(
    "SELECT kind, name, year, slug, stars FROM lb_entries WHERE user_id = $1",
    [userId],
  );
  const entries: LbEntry[] = rows.map((r) => ({ kind: r.kind, name: r.name, year: r.year || null, slug: r.slug, stars: r.stars == null ? null : Number(r.stars) }));
  const f = opts.fetchImpl ?? fetch;
  let fetched = 0;
  // rebuilt from scratch: a film removed from Letterboxd must stop triggering mails
  await q("DELETE FROM user_films WHERE user_id = $1", [userId]);
  for (const { entry, film } of likelyMatches(entries, films)) {
    let ok = false;
    if (entry.slug) {
      const cached = await q<{ tmdb_id: number | null }>("SELECT tmdb_id FROM lb_slugs WHERE slug = $1", [entry.slug]);
      let tmdbId = cached[0]?.tmdb_id ?? null;
      if (!cached.length && fetched < 10) {
        if (fetched++) await sleep(opts.delayMs ?? 3000);
        const r = await f(`https://letterboxd.com/film/${entry.slug}/`, { headers: { "user-agent": "BijouxBot/1.0" } });
        if (r.status === 200) {
          tmdbId = parseFilmTmdbId(await r.text());
          await q("INSERT INTO lb_slugs (slug, tmdb_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [entry.slug, tmdbId]);
        }
      }
      ok = tmdbId === film.tmdbId;
    } else {
      // CSV entries carry no slug: exact title + year only
      const n = normalizeTitle(entry.name);
      ok = (n === normalizeTitle(film.title) || (!!film.originalTitle && n === normalizeTitle(film.originalTitle))) && (!entry.year || entry.year === film.year);
    }
    if (ok) {
      await q(
        `INSERT INTO user_films (user_id, tmdb_id, kind, stars) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, tmdb_id, kind) DO UPDATE SET stars = EXCLUDED.stars`,
        [userId, film.tmdbId, entry.kind, entry.stars],
      );
    }
  }
}

export async function screeningFilms(now: Date): Promise<ScreeningFilm[]> {
  const rows = await q<{ tmdb_id: number; title: string; original_title: string | null; year: number | null }>(
    "SELECT DISTINCT f.tmdb_id, f.title, f.original_title, f.year FROM films f JOIN screenings s ON s.film_id = f.id WHERE f.tmdb_id IS NOT NULL AND s.starts_at > $1",
    [now.toISOString()],
  );
  return rows.map((r) => ({ tmdbId: r.tmdb_id, title: r.title, originalTitle: r.original_title, year: r.year }));
}

/** Daily: each linked public profile is read at most once per day, then resolved. */
export async function refreshLetterboxd(now: Date) {
  const users = await q<{ id: string; letterboxd_username: string; letterboxd_synced_at: string | null }>(
    "SELECT id, letterboxd_username, letterboxd_synced_at FROM users WHERE letterboxd_username IS NOT NULL",
  );
  const films = await screeningFilms(now);
  for (const u of users) {
    const last = u.letterboxd_synced_at ? new Date(u.letterboxd_synced_at).getTime() : 0;
    if (now.getTime() - last >= 20 * 3_600_000) {
      const r = await readProfile(u.letterboxd_username);
      const kinds = [...new Set(r.entries.map((e) => e.kind))];
      // a cut-short read only replaces the lists it actually read
      await saveEntries(u.id, r.entries, r.complete ? ["watchlist", "seen", "favorite"] : kinds);
      await q("UPDATE users SET letterboxd_synced_at = now() WHERE id = $1", [u.id]);
      await sleep(5000);
    }
    await resolveUser(u.id, films);
  }
}
