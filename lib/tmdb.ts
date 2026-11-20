/** Thin TMDB v3 client (Bearer v4 read token). Responses are memoised per process. */

export interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  release_date?: string;
  poster_path?: string | null;
  vote_count?: number;
}

export interface TmdbDetails extends TmdbMovie {
  runtime?: number;
  directors: string[];
  trailer?: string;
}

const BASE = "https://api.themoviedb.org/3";
const cache = new Map<string, Promise<unknown>>();

/** Called at the start of each daily run: the function process outlives a single run. */
export function clearTmdbCache() {
  cache.clear();
}

function token(): string {
  const t = process.env.TMDB_TOKEN;
  if (!t) throw new Error("TMDB_TOKEN mancante");
  return t;
}

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { headers: { authorization: `Bearer ${token()}`, accept: "application/json" } }).then(async (r) => {
        if (!r.ok) throw new Error(`TMDB ${r.status} su ${path}`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

export const tmdb = {
  async search(query: string, year?: number): Promise<TmdbMovie[]> {
    const r = await get<{ results: TmdbMovie[] }>("/search/movie", {
      query,
      language: "it-IT",
      region: "IT",
      include_adult: "false",
      primary_release_year: year,
    });
    return r.results.slice(0, 10);
  },

  async details(id: number): Promise<TmdbDetails> {
    const r = await get<
      TmdbMovie & {
        runtime?: number;
        credits: { crew: { job: string; name: string }[] };
        videos: { results: { site: string; type: string; key: string; iso_639_1: string }[] };
      }
    >(`/movie/${id}`, { language: "it-IT", append_to_response: "credits,videos", include_video_language: "it,en,null" });
    const trailer =
      r.videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "it") ??
      r.videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
    return {
      id: r.id,
      title: r.title,
      original_title: r.original_title,
      release_date: r.release_date,
      poster_path: r.poster_path,
      vote_count: r.vote_count,
      runtime: r.runtime,
      directors: r.credits.crew.filter((c) => c.job === "Director").map((c) => c.name),
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    };
  },

  async directors(id: number): Promise<string[]> {
    return (await tmdb.details(id)).directors;
  },
};

export const posterUrl = (path: string | null | undefined, size: "w342" | "w500" | "w780" = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
