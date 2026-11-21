/**
 * Printed cinema title → TMDB id.
 * 1. TMDB search (it-IT) on the cleaned title, also on the original title in brackets;
 * 2. candidates scored on title similarity, year and director (credits);
 * 3. below threshold or ambiguous → optional cheap LLM tie-break (if a key is configured), else no match.
 */
import { tmdb, type TmdbMovie } from "./tmdb";

export interface MatchInput {
  title: string;
  year?: number;
  director?: string;
  /** Used for "current release" bias when no year is printed. */
  now?: Date;
}

export interface MatchResult {
  tmdbId: number | null;
  method: "tmdb" | "llm" | "none";
  score: number;
  candidate?: TmdbMovie;
}

export function normalizeTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/&/g, " e ")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => NUMERALS[w] ?? w)
    .join(" ");
}

/** "Dune - Parte 2" = "Dune - Parte due" = "Dune: Part Two". */
const NUMERALS: Record<string, string> = {
  due: "2", tre: "3", quattro: "4", ii: "2", iii: "3", iv: "4", two: "2", three: "3", four: "4", part: "parte",
};

/** Strips noise cinemas add around the title: bracketed original titles, "+ short", restoration notes. */
export function titleVariants(raw: string): string[] {
  const out = new Set<string>();
  const base = raw.replace(/\s*\+\s.*$/, "").replace(/\s*-\s*(versione|edizione).*$/i, "").trim();
  out.add(base);
  const bracket = base.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (bracket) {
    out.add(bracket[1].trim());
    if (!/^\d{4}$|ried|restaur|v\.?o/i.test(bracket[2])) out.add(bracket[2].trim());
  }
  // "Die Hard- Trappola di Cristallo", "Radio Praga - le Onde…": a dash followed by a space splits two titles
  const dash = base.split(/\s*[–-]\s+/);
  if (dash.length > 1) {
    out.add(dash[0].trim());
    out.add(dash.slice(1).join(" ").trim());
  }
  return [...out].filter((t) => t.length > 0);
}

function tokens(s: string): Set<string> {
  return new Set(normalizeTitle(s).split(" ").filter(Boolean));
}

/** Dice coefficient on word tokens, 1 for exact normalised equality. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

const letters = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^\p{L}]/gu, "");
const latin = (s: string) => /[a-z]/i.test(s.normalize("NFD"));
const NAME_NOISE = new Set(["st", "jr", "sr", "ст", "мл"]);

/**
 * true / false, or null when it cannot be told (TMDB gives the name in another script, e.g. 大島渚).
 * Compares spaceless names so "John Mc Tiernan" ~ "John McTiernan", "Kore’eda" ~ "Kore-eda", "C. MUNGIU" ~ "Cristian Mungiu".
 */
export function directorMatches(printed: string | undefined, directors: string[]): boolean | null {
  if (!printed || !directors.length) return null;
  const printedNames = printed.split(/,|\/|&|\se\s|\sand\s/).map((s) => s.trim()).filter(Boolean);
  const comparable = directors.filter((d) => latin(d) === latin(printed));
  if (!comparable.length) return null;
  for (const p of printedNames) {
    const whole = letters(p);
    for (const d of comparable) {
      const parts = d.split(/[\s-]+/).map(letters).filter((x) => x.length >= 3 && !NAME_NOISE.has(x));
      const dWhole = letters(d);
      const pParts = p.split(/[\s.]+/).map(letters).filter((x) => x.length >= 3 && !NAME_NOISE.has(x));
      if (parts.some((x) => whole.includes(x)) || pParts.some((x) => dWhole.includes(x))) return true;
    }
  }
  return false;
}

export function scoreCandidate(input: MatchInput, c: TmdbMovie, directors: string[] | null): number {
  const variants = titleVariants(input.title);
  const full = new Set(fullVariants(input.title).map(normalizeTitle));
  const names = [c.title, c.original_title, c.title_en].filter((x): x is string => !!x);
  const sim = Math.max(
    ...variants.flatMap((v) =>
      names.map((n) => {
        let s = titleSimilarity(v, n);
        // "L'impero dei sensi" inside "Ecco l'impero dei sensi": whole printed title contained (3+ words)
        const nv = ` ${normalizeTitle(v)} `;
        if (nv.trim().split(" ").length >= 3 && ` ${normalizeTitle(n)} `.includes(nv)) s = Math.max(s, 0.95);
        // a fragment ("Dune" out of "Dune - Parte 2") must not beat the whole printed title
        return full.has(normalizeTitle(v)) ? s : s * 0.85;
      }),
    ),
  );
  let score = sim * 60;
  const year = c.release_date ? Number(c.release_date.slice(0, 4)) : null;
  if (input.year && year) score += input.year === year ? 20 : Math.abs(input.year - year) === 1 ? 10 : -15;
  else if (!input.year && year && input.now) {
    // no printed year: a film in a cinema is usually recent; classics carry a director we can check
    const age = input.now.getUTCFullYear() - year;
    score += age <= 1 ? 10 : age <= 3 ? 4 : 0;
  }
  if (directors) {
    const d = directorMatches(input.director, directors);
    if (d === true) score += 30;
    else if (d === false) score -= 20;
  }
  score += Math.min(5, Math.log10(1 + (c.vote_count ?? 0)));
  return score;
}

const ACCEPT = 62;

async function anyDirectorMatch(input: MatchInput, cands: TmdbMovie[]): Promise<boolean> {
  for (const c of cands) if (directorMatches(input.director, await tmdb.directors(c.id)) === true) return true;
  return false;
}

/** Films directed by the first printed name (a cheap person search + their credits). */
async function filmsByDirector(printed: string): Promise<TmdbMovie[]> {
  const name = printed.split(/,|\/|&|\se\s|\sand\s/)[0].replace(/\b[A-Z]\.\s*/g, "").trim();
  if (name.length < 4) return [];
  const person = await tmdb.directorByName(name);
  return person ? tmdb.directed(person) : [];
}

/** The whole printed title and its bracketed original title: not fragments. */
function fullVariants(raw: string): string[] {
  const base = raw.replace(/\s*\+\s.*$/, "").trim();
  const bracket = base.match(/^(.*?)\s*\((.+)\)\s*$/);
  return bracket ? [base, bracket[1], bracket[2]] : [base];
}

export async function matchTitle(input: MatchInput): Promise<MatchResult> {
  const seen = new Map<number, TmdbMovie>();
  const add = (c: TmdbMovie, lang: "it-IT" | "en-US") => {
    const prev = seen.get(c.id);
    if (lang === "en-US") seen.set(c.id, { ...(prev ?? c), title_en: c.title });
    else seen.set(c.id, { ...c, title_en: prev?.title_en });
  };
  for (const v of titleVariants(input.title)) {
    for (const lang of ["it-IT", "en-US"] as const) {
      for (const c of await tmdb.search(v, input.year, lang)) add(c, lang);
      if (input.year) for (const c of await tmdb.search(v, undefined, lang)) add(c, lang);
    }
  }
  if (seen.size === 0 && !input.director) return { tmdbId: null, method: "none", score: 0 };

  // cheap pre-score without credits, then fetch credits for the top few
  const pre = [...seen.values()]
    .map((c) => ({ c, s: scoreCandidate(input, c, null) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, input.director ? 5 : 3);
  const scored = await Promise.all(
    pre.map(async ({ c }) => {
      const directors = input.director ? await tmdb.directors(c.id) : null;
      return { c, s: scoreCandidate(input, c, directors) };
    }),
  );
  // printed director but no candidate by them: the film may be outside the top search results
  // ("Tutto o niente" by Mike Leigh) — look through the director's own filmography
  if (input.director && !(await anyDirectorMatch(input, pre.map((p) => p.c)))) {
    for (const c of await filmsByDirector(input.director)) {
      if (!scored.some((s) => s.c.id === c.id)) scored.push({ c, s: scoreCandidate(input, c, await tmdb.directors(c.id)) });
    }
  }
  if (!scored.length) return { tmdbId: null, method: "none", score: 0 };
  scored.sort((a, b) => b.s - a.s);
  const [best, second] = scored;
  // exactly one candidate is by the printed director and its title is plausible: that's it
  if (input.director) {
    const byDirector = [];
    for (const s of scored) if (directorMatches(input.director, await tmdb.directors(s.c.id)) === true) byDirector.push(s);
    if (byDirector.length === 1 && byDirector[0].s >= 55) {
      const d = byDirector[0];
      return { tmdbId: d.c.id, method: "tmdb", score: d.s, candidate: d.c };
    }
  }
  const clear = !second || best.s - second.s >= 8;
  if (best.s >= ACCEPT && clear) return { tmdbId: best.c.id, method: "tmdb", score: best.s, candidate: best.c };
  if (best.s >= ACCEPT + 15) return { tmdbId: best.c.id, method: "tmdb", score: best.s, candidate: best.c };
  // a lone plausible candidate far ahead of the rest
  if (best.s >= ACCEPT - 12 && (!second || best.s - second.s >= 20)) return { tmdbId: best.c.id, method: "tmdb", score: best.s, candidate: best.c };
  return { tmdbId: null, method: "none", score: best.s, candidate: best.c };
}
