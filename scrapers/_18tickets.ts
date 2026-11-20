import * as cheerio from "cheerio";
import type { CinemaId, Screening } from "@/lib/types";
import { cleanTitle } from "./_text";

/** 18tickets home page: one `.movie--preview` card per film, each showtime an `a[data-time]` (epoch ms). */
export function parse18tickets(html: string, cinemaId: CinemaId): Screening[] {
  const $ = cheerio.load(html);
  const out: Screening[] = [];
  $(".movie.movie--preview").each((_, card) => {
    const c = $(card);
    const rawTitle = c.find("a.movie__title").first().text();
    if (!rawTitle.trim()) return;
    const opt = (label: string) =>
      c
        .find("p.movie__option")
        .filter((_, p) => $(p).find("strong").text().includes(label))
        .first()
        .clone()
        .children("strong")
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .trim();
    const lang = opt("Lingua");
    const { title, vo, special } = cleanTitle(rawTitle);
    const director = opt("Regia") || undefined;
    const voFromLang = /sott|originale|v\.?o\b/i.test(lang) || (!!lang && !/^italiano$/i.test(lang));
    c.find("a[data-time]").each((_, a) => {
      const ms = Number($(a).attr("data-time"));
      if (!Number.isFinite(ms) || ms <= 0) return;
      out.push({
        cinemaId,
        title,
        startsAt: new Date(ms).toISOString(),
        vo: vo || voFromLang,
        special,
        url: $(a).attr("href") ?? "",
        director,
      });
    });
  });
  return out;
}
