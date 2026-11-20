import type { CinemaId, Screening } from "@/lib/types";
import { romeToIso } from "@/lib/time";
import { cleanTitle, decodeEntities } from "./_text";

/** Minimal iCalendar reader: VEVENT SUMMARY / DTSTART (TZID=Europe/Rome or UTC) / URL. */
export function parseIcs(ics: string, cinemaId: CinemaId, fallbackUrl: string): Screening[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const out: Screening[] = [];
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const field = (name: string) => body.match(new RegExp(`^${name}(;[^:\\r\\n]*)?:(.*)$`, "m"));
    const summary = field("SUMMARY")?.[2]?.replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
    const dt = field("DTSTART");
    if (!summary || !dt) continue;
    const m = dt[2].trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) continue;
    const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
    const startsAt = m[7] === "Z" ? new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString() : romeToIso(y, mo, d, h, mi);
    const { title, vo, special } = cleanTitle(decodeEntities(summary));
    out.push({ cinemaId, title, startsAt, vo, special, url: field("URL")?.[2]?.trim() || fallbackUrl });
  }
  return out;
}
