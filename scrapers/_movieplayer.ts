import * as cheerio from "cheerio";
import type { CinemaId, Screening } from "@/lib/types";
import { romeToIso, romeToday } from "@/lib/time";
import { cleanTitle, parseHourMinute } from "./_text";

/**
 * movieplayer.it cinema page: today's schedule only. The daily run accumulates
 * the week, one day per run.
 */
export function parseMovieplayer(html: string, cinemaId: CinemaId, pageUrl: string, now: Date): Screening[] {
  const $ = cheerio.load(html);
  const { y, m, d } = romeToday(now);
  const out: Screening[] = [];
  $(".grid-item").each((_, el) => {
    const item = $(el);
    const rawTitle = item.find(".grid-item__title").first().text();
    const hours = item.find(".list-hours > div");
    if (!rawTitle.trim() || hours.length === 0) return;
    const { title, vo, special } = cleanTitle(rawTitle);
    const director = item.find(".media__cast a").first().text().replace(/^film di\s+/i, "").trim() || undefined;
    const yearMatch = item.text().match(/\b(19|20)\d{2}\s*\/\s*\d+\s*min/);
    hours.each((_, h) => {
      const text = $(h).text().replace(/\s+/g, " ").trim();
      const hm = parseHourMinute(text);
      if (!hm) return;
      out.push({
        cinemaId,
        title,
        startsAt: romeToIso(y, m, d, hm.h, hm.min),
        vo: vo || /originale|v\.?o\./i.test(text),
        special,
        url: pageUrl,
        director,
        year: yearMatch ? Number(yearMatch[0].slice(0, 4)) : undefined,
      });
    });
  });
  return out;
}
