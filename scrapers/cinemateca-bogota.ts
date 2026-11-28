import * as cheerio from "cheerio";
import type { Screening } from "@/lib/types";
import { inferYear, todayIn, zonedToIso } from "@/lib/time";
import { fetchText } from "./_http";

const TZ = "America/Bogota";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WHEN_RE = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i;
/** Program strands that are events rather than regular runs. */
const SPECIAL = /festival|muestra|clásico|clasico|ciclo|retrospectiva|especial|competencia/i;
/** Not films: guided tours, talks, workshops. */
const NOT_A_FILM = /^(visita|charla|conversatorio|taller|clase|lanzamiento)/i;
/** Festival programme codes in front of the title: "CI-ANI1 | Competencia Internacional Animación 1". */
const PROGRAMME_CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\/[A-Z0-9-]+)?\s*\|\s*/;

export interface FilmDetail {
  director?: string;
  year?: number;
  /** Spoken language as printed ("Japonés"). */
  language?: string;
  subtitles?: string;
  poster?: string;
}

export interface CinematecaBundle {
  grid: string;
  /** Detail page HTML by absolute URL; films without a page (or not fetched) are simply missing. */
  details: Record<string, string>;
}

/**
 * cinematecadebogota.gov.co/agenda/11 (the Cinemateca's own building: Sala Capital, Sala 2, Sala 3, Sala E).
 * A Drupal grid: one `.views-view-responsive-grid__item` per screening, with category, title and
 * "Sala 2 Noviembre 28 2:00 pm". The page carries the whole year, so only screenings from today on
 * are kept. Titles stay as printed (Spanish, original in brackets); festival programme codes are dropped.
 */
export function parse(html: string, now: Date, pageUrl: string): Screening[] {
  const $ = cheerio.load(html);
  const ref = todayIn(TZ, now);
  const from = Date.UTC(ref.y, ref.m - 1, ref.d);
  const base = new URL(pageUrl);
  const out: Screening[] = [];
  $(".views-view-responsive-grid__item").each((_, el) => {
    const item = $(el);
    const link = item.find(".views-field-title a").first();
    const printed = link.text().replace(/\s+/g, " ").trim();
    const title = printed.replace(PROGRAMME_CODE, "").trim();
    const category = item.find(".views-field-field-taxonomy-1").text().replace(/\s+/g, " ").trim();
    const when = item.find(".views-field-nothing").text().replace(/\s+/g, " ").trim().match(WHEN_RE);
    if (!title || !when || NOT_A_FILM.test(title)) return;
    const m = MESES.indexOf(when[1].toLowerCase()) + 1;
    const d = Number(when[2]);
    let h = Number(when[3]) % 12;
    if (when[5].toLowerCase() === "p") h += 12;
    const y = inferYear(m, d, ref);
    if (Date.UTC(y, m - 1, d) < from) return;
    const href = link.attr("href");
    const thumb = item.find(".views-field-field-image-1 img").first().attr("src");
    out.push({
      cinemaId: "cinemateca-bogota",
      title,
      startsAt: zonedToIso(TZ, y, m, d, h, Number(when[4])),
      vo: false, // filled from the detail page when there is one
      special: SPECIAL.test(category) || PROGRAMME_CODE.test(printed),
      url: href ? new URL(href, base).toString() : pageUrl,
      ...(thumb ? { poster: new URL(thumb, base).toString() } : {}),
    });
  });
  return out;
}

/** One film page: director, year, language, subtitles, poster (Drupal field classes). */
export function parseDetail(html: string, pageUrl: string): FilmDetail {
  const $ = cheerio.load(html);
  const field = (name: string) => $(`.field--name-${name}`).first().find(".field__item").addBack(".field__item").first().text().replace(/\s+/g, " ").trim() || undefined;
  const year = Number(field("field-numeric"));
  const img = $(".field--name-field-image-1 img").first().attr("src");
  return {
    director: field("field-simple-text-1"),
    year: year >= 1890 && year <= 2100 ? year : undefined,
    language: field("field-language"),
    subtitles: field("field-subtitle-language"),
    poster: img ? new URL(img, pageUrl).toString() : undefined,
  };
}

/** Spoken language other than Spanish, with subtitles: shown in original language. */
export function isVo(d: FilmDetail): boolean {
  return !!d.language && !/espa[nñ]ol|castellano|sin di[aá]logos/i.test(d.language) && !!d.subtitles;
}

export function parseBundle(bundle: CinematecaBundle, now: Date, pageUrl: string): Screening[] {
  return parse(bundle.grid, now, pageUrl).map((s) => {
    const html = bundle.details[s.url];
    if (!html) return s;
    const d = parseDetail(html, s.url);
    return { ...s, director: d.director, year: d.year, vo: isVo(d), poster: d.poster ?? s.poster };
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Live read: the agenda, then each film page once (programmes of shorts have no single director
 * and are skipped), 700 ms apart. Runs weekly, so ~80 requests a week.
 */
export async function fetchBundle(pageUrl: string, now = new Date()): Promise<CinematecaBundle> {
  const grid = await fetchText(pageUrl);
  const $ = cheerio.load(grid);
  const programmes = new Set<string>();
  $(".views-field-title a").each((_, a) => {
    if (PROGRAMME_CODE.test($(a).text().trim())) programmes.add(new URL($(a).attr("href") ?? "", pageUrl).toString());
  });
  const urls = [...new Set(parse(grid, now, pageUrl).map((s) => s.url))].filter((u) => u !== pageUrl && !programmes.has(u));
  const details: Record<string, string> = {};
  for (const u of urls) {
    await sleep(700);
    try {
      details[u] = await fetchText(u);
    } catch {
      // one missing page costs that film its director, not the whole cinema
    }
  }
  return { grid, details };
}
