import * as cheerio from "cheerio";
import type { Screening } from "@/lib/types";
import { inferYear, todayIn, zonedToIso } from "@/lib/time";

const TZ = "America/Bogota";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WHEN_RE = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i;
/** Program strands that are events rather than regular runs. */
const SPECIAL = /festival|muestra|clásico|clasico|ciclo|retrospectiva|especial|competencia/i;
/** Not films: guided tours, talks, workshops. */
const NOT_A_FILM = /^(visita|charla|conversatorio|taller|clase|lanzamiento)/i;

/**
 * cinematecadebogota.gov.co/agenda/11 (the Cinemateca's own building: Sala Capital, Sala 2, Sala 3, Sala E).
 * A Drupal grid: one `.views-view-responsive-grid__item` per screening, with category, title and
 * "Sala 2 Noviembre 28 2:00 pm". The page carries the whole year, so only screenings from today on
 * are kept. Titles stay as printed (Spanish, original in brackets).
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
    const title = link.text().replace(/\s+/g, " ").trim();
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
    out.push({
      cinemaId: "cinemateca-bogota",
      title,
      startsAt: zonedToIso(TZ, y, m, d, h, Number(when[4])),
      vo: false, // not printed: foreign films are usually subtitled, but the agenda does not say
      special: SPECIAL.test(category),
      url: href ? new URL(href, base).toString() : pageUrl,
    });
  });
  return out;
}
