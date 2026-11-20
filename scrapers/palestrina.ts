import * as cheerio from "cheerio";
import type { Screening } from "@/lib/types";
import { monthFromItalian, romeToIso } from "@/lib/time";
import { cleanTitle, parseHourMinute } from "./_text";

const TABS = ["thu", "fri", "sat", "sun", "mon", "tue", "wed"] as const;

/** progettolumiere.it: one tab per weekday, Thursday→Wednesday; the header gives the week. */
export function parse(html: string, _now: Date, pageUrl: string): Screening[] {
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ");
  const wk = text.match(
    /Programmazione da \S+ (\d{1,2})(?: ([a-zà-ù]+))?(?: (\d{4}))? a \S+ (\d{1,2}) ([a-zà-ù]+) (\d{4})/i,
  );
  if (!wk) throw new Error("Palestrina: intestazione della settimana non trovata");
  const endMonth = monthFromItalian(wk[5]);
  const endYear = Number(wk[6]);
  const startMonth = wk[2] ? monthFromItalian(wk[2]) : endMonth;
  const startYear = wk[3] ? Number(wk[3]) : startMonth > endMonth ? endYear - 1 : endYear;
  const start = Date.UTC(startYear, startMonth - 1, Number(wk[1]));
  const base = new URL(pageUrl);
  const out: Screening[] = [];
  TABS.forEach((tab, i) => {
    const day = new Date(start + i * 86400000);
    $(`#${tab} .movie-tabs`).each((_, row) => {
      const r = $(row);
      const raw = r.find("h3").first().text();
      if (!raw.trim()) return;
      const { title, vo, special } = cleanTitle(raw);
      const href = r.find("a.arrow-button").attr("href") ?? r.find("a").attr("href") ?? "";
      r.find(".time").each((_, t) => {
        const label = $(t).text();
        const hm = parseHourMinute(label);
        if (!hm) return;
        const prev = $(t).prev().text();
        out.push({
          cinemaId: "palestrina",
          title,
          startsAt: romeToIso(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hm.h, hm.min),
          vo: vo || /\bVO\b/.test(label) || /\bVO\b/.test(prev),
          special,
          url: href ? new URL(href, base).toString() : pageUrl,
        });
      });
    });
  });
  return out;
}
