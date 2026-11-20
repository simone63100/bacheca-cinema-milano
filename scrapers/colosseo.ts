import * as cheerio from "cheerio";
import type { Screening } from "@/lib/types";
import { inferYear, romeToIso, romeToday } from "@/lib/time";
import { cleanTitle, parseHourMinute } from "./_text";

/** ilregnodelcinema.com: `.filmContainer` with `ul.orari > li` per day ("Venerdì 20/11"). */
export function parse(html: string, now: Date, pageUrl: string): Screening[] {
  const $ = cheerio.load(html);
  const ref = romeToday(now);
  const out: Screening[] = [];
  $(".filmContainer").each((_, el) => {
    const f = $(el);
    const raw = f.find(".datiFilm .titolo").first().text();
    if (!raw.trim()) return;
    const { title, vo, special } = cleanTitle(raw);
    const img = f.find(".locandina img").attr("src");
    const poster = img ? new URL(img, pageUrl).toString() : undefined;
    const director = f.find(".regia").text().replace(/Regia:/i, "").trim() || undefined;
    f.find("ul.orari li.hours").each((_, li) => {
      const dm = $(li).find(".dayName").text().match(/(\d{1,2})\/(\d{1,2})/);
      if (!dm) return;
      const d = Number(dm[1]);
      const m = Number(dm[2]);
      const y = inferYear(m, d, ref);
      $(li)
        .find("span[class^=orario]")
        .each((_, s) => {
          const hm = parseHourMinute($(s).text());
          if (!hm) return;
          out.push({
            cinemaId: "colosseo",
            title,
            startsAt: romeToIso(y, m, d, hm.h, hm.min),
            vo,
            special,
            url: pageUrl,
            director,
            poster,
          });
        });
    });
  });
  return out;
}
