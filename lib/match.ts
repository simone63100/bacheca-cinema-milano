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
    .trim();
}

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
  const dash = base.split(/\s+[–-]\s+/);
  if (dash.length > 1) out.add(dash[0].trim());
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

function surname(name: string): string {
  const parts = normalizeTitle(name.replace(/^[A-Z]\.\s*/, "")).split(" ");
  return parts[parts.length - 1] ?? "";
}

export function directorMatches(printed: string | undefined, directors: string[]): boolean {
  if (!printed) return false;
  const wanted = printed.split(/,|\be\b|&/).map(surname).filter((s) => s.length > 2);
  const have = directors.map(surname);
  return wanted.some((w) => have.includes(w));
}

export function scoreCandidate(input: MatchInput, c: TmdbMovie, directors: string[] | null): number {
  const variants = titleVariants(input.title);
  const sim = Math.max(
    ...variants.flatMap((v) => [titleSimilarity(v, c.title), titleSimilarity(v, c.original_title)]),
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
    if (directorMatches(input.director, directors)) score += 30;
    else if (input.director) score -= 20;
  }
  score += Math.min(5, Math.log10(1 + (c.vote_count ?? 0)));
  return score;
}

const ACCEPT = 62;

export async function matchTitle(input: MatchInput): Promise<MatchResult> {
  const seen = new Map<number, TmdbMovie>();
  for (const v of titleVariants(input.title)) {
    for (const c of await tmdb.search(v, input.year)) seen.set(c.id, c);
    if (input.year) for (const c of await tmdb.search(v)) seen.set(c.id, c);
  }
  if (seen.size === 0) return { tmdbId: null, method: "none", score: 0 };

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
  scored.sort((a, b) => b.s - a.s);
  const [best, second] = scored;
  const clear = !second || best.s - second.s >= 8;
  if (best.s >= ACCEPT && clear) return { tmdbId: best.c.id, method: "tmdb", score: best.s, candidate: best.c };
  if (best.s >= ACCEPT + 15) return { tmdbId: best.c.id, method: "tmdb", score: best.s, candidate: best.c };
  return { tmdbId: null, method: "none", score: best.s, candidate: best.c };
}
