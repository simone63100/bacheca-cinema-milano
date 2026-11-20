import * as cheerio from "cheerio";
import type { Screening } from "@/lib/types";
import { monthFromItalian, romeToIso } from "@/lib/time";
import { cleanTitle, parseHourMinute } from "./_text";

/** ilcinemino.it (Theater for WordPress): month table, one cell per day with `.wp_theatre_event`s. */
export function parse(html: string, _now: Date, pageUrl: string): Screening[] {
  const $ = cheerio.load(html);
  const out: Screening[] = [];
  $("table.wpt_month").each((_, table) => {
    const cap = $(table).find("caption").text().trim().match(/([A-Za-zà-ù]+)\s+(\d{4})/);
    if (!cap) return;
    const capMonth = monthFromItalian(cap[1]);
    const capYear = Number(cap[2]);
    const cells = $(table).find("td").toArray();
    const days = cells.map((td) =>
      Number($(td).find(".wpt_calendar_day_label").text().match(/(\d{1,2})/)?.[1] ?? NaN),
    );
    // The grid may start with the tail of the previous month (a late day followed, within the
    // first week, by a wrap to 1) or, in the week view, end with the head of the next month.
    const labelled = days.map((d, i) => ({ d, i })).filter((x) => Number.isFinite(x.d));
    const firstWrap = labelled.findIndex((x, k) => k > 0 && x.d < labelled[k - 1].d);
    const leadsWithPrevMonth = firstWrap > 0 && firstWrap < 7 && labelled[0].d > 20;
    let offset = leadsWithPrevMonth ? -1 : 0;
    let prev = 0;
    cells.forEach((td, i) => {
      const d = days[i];
      if (!Number.isFinite(d)) return;
      if (prev && d < prev) offset += 1;
      prev = d;
      const idx = capMonth - 1 + offset;
      const mm = ((idx % 12) + 12) % 12 + 1;
      const yy = capYear + Math.floor(idx / 12);
      $(td)
        .find(".wp_theatre_event")
        .each((_, ev) => {
          const raw = $(ev).find(".wp_theatre_event_title").text();
          const hm = parseHourMinute($(ev).find(".wp_theatre_event_starttime").text());
          if (!raw.trim() || !hm) return;
          const { title, vo, special } = cleanTitle(raw);
          out.push({
            cinemaId: "cinemino",
            title,
            startsAt: romeToIso(yy, mm, d, hm.h, hm.min),
            vo,
            special,
            url: $(ev).find("a").attr("href") ?? pageUrl,
          });
        });
    });
  });
  return out;
}
