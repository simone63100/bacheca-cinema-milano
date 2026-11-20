/**
 * Letterboxd (SPEC: A = public profile read server-side once a day; B = CSV upload as fallback).
 *
 * Letterboxd answers bursts with a Cloudflare challenge (403), so the reader is deliberately slow:
 * one page every few seconds, a hard page cap, stop at the first non-200 and keep what was read.
 * We never resolve a whole watchlist to TMDB: entries are stored raw (slug, name, year) and only
 * the ones that look like a film currently in a cinema get their TMDB id read from the film page.
 */
import * as cheerio from "cheerio";
import { normalizeTitle, titleSimilarity } from "./match";

export type LbKind = "watchlist" | "seen" | "favorite";

export interface LbEntry {
  slug: string | null;
  name: string;
  year: number | null;
  kind: LbKind;
  /** 0.5–5 for rated films. */
  stars: number | null;
}

const UA = "BijouxBot/1.0 (watchlist pubblica dell'utente che l'ha collegata; 1 lettura al giorno)";
const BASE = "https://letterboxd.com";

export const USERNAME_RE = /^[A-Za-z0-9_]{2,15}$/;

function splitNameYear(s: string): { name: string; year: number | null } {
  const m = s.trim().match(/^(.*)\s+\((\d{4})\)$/);
  return m ? { name: m[1], year: Number(m[2]) } : { name: s.trim(), year: null };
}

/** Grid pages: /u/watchlist/, /u/films/…  (`li.griditem` with data-item-*). */
export function parseGrid(html: string, kind: LbKind): { entries: LbEntry[]; lastPage: number } {
  const $ = cheerio.load(html);
  const entries: LbEntry[] = [];
  $("li.griditem").each((_, li) => {
    const el = $(li).find("[data-item-slug]").first().length ? $(li).find("[data-item-slug]").first() : $(li);
    const slug = el.attr("data-item-slug") ?? null;
    const full = el.attr("data-item-name") ?? $(li).find("img").attr("alt") ?? "";
    if (!full) return;
    const { name, year } = splitNameYear(full);
    const ratedClass = $(li).find("[class*='rated-']").attr("class")?.match(/rated-(\d+)/);
    entries.push({ slug, name, year, kind, stars: ratedClass ? Number(ratedClass[1]) / 2 : null });
  });
  const pages = $(".paginate-page a")
    .map((_, a) => Number($(a).text().trim()))
    .get()
    .filter(Number.isFinite);
  return { entries, lastPage: pages.length ? Math.max(...pages) : 1 };
}

/** Profile page: the four favourite films. */
export function parseFavourites(html: string): LbEntry[] {
  const $ = cheerio.load(html);
  const out: LbEntry[] = [];
  $("#favourites [data-item-slug], #favourites [data-film-slug]").each((_, el) => {
    const slug = $(el).attr("data-item-slug") ?? $(el).attr("data-film-slug") ?? null;
    const { name, year } = splitNameYear($(el).attr("data-item-name") ?? $(el).find("img").attr("alt") ?? slug ?? "");
    if (name) out.push({ slug, name, year, kind: "favorite", stars: null });
  });
  return out;
}

export function parseFilmTmdbId(html: string): number | null {
  const m = html.match(/data-tmdb-type="movie"[^>]*data-tmdb-id="(\d+)"|data-tmdb-id="(\d+)"[^>]*data-tmdb-type="movie"/);
  return m ? Number(m[1] ?? m[2]) : null;
}

/** Letterboxd export CSV (watchlist.csv: Date,Name,Year,Letterboxd URI; ratings.csv adds Rating). */
export function parseCsv(text: string, kind: LbKind): LbEntry[] {
  const rows = csvRows(text.replace(/^﻿/, ""));
  const [head, ...body] = rows;
  if (!head) return [];
  const col = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
  const iName = col("name");
  const iYear = col("year");
  const iRating = col("rating");
  if (iName < 0) throw new Error("CSV di Letterboxd non riconosciuto: manca la colonna Name");
  return body
    .filter((r) => r[iName]?.trim())
    .map((r) => ({
      slug: null,
      name: r[iName].trim(),
      year: iYear >= 0 && r[iYear] ? Number(r[iYear]) : null,
      kind,
      stars: iRating >= 0 && r[iRating] ? Number(r[iRating]) : null,
    }));
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ReadOptions {
  delayMs?: number;
  maxPages?: number;
  fetchImpl?: typeof fetch;
}

/** Reads a public profile slowly. Returns what it could read and whether it was cut short. */
export async function readProfile(username: string, opts: ReadOptions = {}): Promise<{ entries: LbEntry[]; complete: boolean; requests: number }> {
  if (!USERNAME_RE.test(username)) throw new Error("username Letterboxd non valido");
  const f = opts.fetchImpl ?? fetch;
  const delay = opts.delayMs ?? 3000;
  const maxPages = opts.maxPages ?? 40;
  let requests = 0;
  const get = async (path: string): Promise<string | null> => {
    if (requests > 0) await sleep(delay);
    requests++;
    const r = await f(`${BASE}${path}`, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow" });
    if (r.status !== 200) return null;
    const html = await r.text();
    return /<title>Just a moment/i.test(html) ? null : html;
  };

  const entries: LbEntry[] = [];
  let complete = true;
  const grid = async (path: string, kind: LbKind) => {
    for (let p = 1, last = 1; p <= last && requests < maxPages; p++) {
      const html = await get(`/${username}/${path}${p > 1 ? `page/${p}/` : ""}`);
      if (!html) {
        complete = false;
        return;
      }
      const page = parseGrid(html, kind);
      entries.push(...page.entries);
      last = page.lastPage;
      if (p === last) return;
    }
    if (requests >= maxPages) complete = false;
  };

  const profile = await get(`/${username}/`);
  if (!profile) return { entries, complete: false, requests };
  entries.push(...parseFavourites(profile));
  await grid("watchlist/", "watchlist");
  // blocked once → stop for today: a second request after a challenge only makes it worse
  if (complete) await grid("films/by/rating/", "seen");
  return { entries, complete, requests };
}

export interface ScreeningFilm {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
}

/** Cheap pre-filter: which Letterboxd entries might be one of the films in cinemas now. */
export function likelyMatches(entries: LbEntry[], films: ScreeningFilm[]): { entry: LbEntry; film: ScreeningFilm }[] {
  const out: { entry: LbEntry; film: ScreeningFilm }[] = [];
  for (const e of entries) {
    const n = normalizeTitle(e.name);
    for (const f of films) {
      const sim = Math.max(titleSimilarity(n, f.title), f.originalTitle ? titleSimilarity(n, f.originalTitle) : 0);
      const yearOk = !e.year || !f.year || Math.abs(e.year - f.year) <= 1;
      if (sim >= 0.85 && yearOk) out.push({ entry: e, film: f });
    }
  }
  return out;
}
