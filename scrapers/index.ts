import { CINEMAS, cinemaById } from "@/lib/cinemas";
import { cityById } from "@/lib/cities";
import { hourIn } from "@/lib/time";
import type { CinemaId, Screening } from "@/lib/types";
import { fetchBytes, fetchText } from "./_http";
import { parse18tickets } from "./_18tickets";
import { parseIcs } from "./_ics";
import { parseMovieplayer } from "./_movieplayer";
import * as cineColombia from "./cine-colombia";
import * as cinemateca from "./cinemateca-bogota";
import * as cinemino from "./cinemino";
import * as colosseo from "./colosseo";
import * as godard from "./godard";
import * as palestrina from "./palestrina";

export interface ScraperDef {
  id: CinemaId;
  /** File name under scrapers/__fixtures__/. */
  fixture: string;
  /** "pdf" sources are converted to text before parse(). */
  format: "text" | "pdf" | "cine-colombia";
  parse(body: string, now: Date): Screening[];
}

const src = (id: CinemaId) => cinemaById(id).source;

export const SCRAPERS: Record<CinemaId, ScraperDef> = {
  palestrina: { id: "palestrina", fixture: "palestrina.html", format: "text", parse: (b, n) => palestrina.parse(b, n, src("palestrina")) },
  arlecchino: { id: "arlecchino", fixture: "arlecchino.html", format: "text", parse: (b) => parse18tickets(b, "arlecchino") },
  mic: { id: "mic", fixture: "mic.html", format: "text", parse: (b) => parse18tickets(b, "mic") },
  godard: { id: "godard", fixture: "godard.pdf", format: "pdf", parse: (b) => godard.parseProgrammeText(b, cinemaById("godard").url) },
  anteo: { id: "anteo", fixture: "anteo.html", format: "text", parse: (b) => parse18tickets(b, "anteo") },
  citylife: { id: "citylife", fixture: "citylife.html", format: "text", parse: (b) => parse18tickets(b, "citylife") },
  colosseo: { id: "colosseo", fixture: "colosseo.html", format: "text", parse: (b, n) => colosseo.parse(b, n, src("colosseo")) },
  beltrade: { id: "beltrade", fixture: "beltrade.ics", format: "text", parse: (b) => parseIcs(b, "beltrade", cinemaById("beltrade").url) },
  arcobaleno: { id: "arcobaleno", fixture: "arcobaleno.html", format: "text", parse: (b, n) => parseMovieplayer(b, "arcobaleno", src("arcobaleno"), n) },
  cinemino: { id: "cinemino", fixture: "cinemino.html", format: "text", parse: (b, n) => cinemino.parse(b, n, src("cinemino")) },
  ariosto: { id: "ariosto", fixture: "ariosto.html", format: "text", parse: (b) => parse18tickets(b, "ariosto") },
  centrale: { id: "centrale", fixture: "centrale.html", format: "text", parse: (b, n) => parseMovieplayer(b, "centrale", src("centrale"), n) },
  mexico: { id: "mexico", fixture: "mexico.html", format: "text", parse: (b, n) => parseMovieplayer(b, "mexico", src("mexico"), n) },
  "cinecolombia-santafe": {
    id: "cinecolombia-santafe",
    fixture: "cine-colombia-santafe.json",
    format: "cine-colombia",
    parse: (b) => cineColombia.parseBundle(JSON.parse(b) as cineColombia.CcBundle, "cinecolombia-santafe", "6659", src("cinecolombia-santafe")),
  },
  "cinemateca-bogota": {
    id: "cinemateca-bogota",
    fixture: "cinemateca-bogota.html",
    format: "text",
    parse: (b, n) => cinemateca.parse(b, n, src("cinemateca-bogota")),
  },
};

const NOT_A_FILM = /^(visita|presentaz|laboratorio|aperitivo|concerto|reading|dj set|live set)\b/i;

/** Drops non-film events, pre-dawn placeholders (e.g. Beltrade's 06:00 "KEEP CALM"), duplicates, and empty titles. */
export function sanitize(rows: Screening[]): Screening[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const h = hourIn(cityById(cinemaById(r.cinemaId).city).tz, r.startsAt); // local hour in the cinema's city
    if (!r.title || h < 8 || NOT_A_FILM.test(r.title)) return false;
    const k = `${r.cinemaId}|${r.title.toLowerCase()}|${r.startsAt}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function readSource(def: ScraperDef): Promise<string> {
  const url = src(def.id);
  if (def.format === "pdf") return godard.pdfToText(await fetchBytes(url));
  if (def.format === "cine-colombia") return JSON.stringify(await cineColombia.fetchBundle(url, "6659"));
  return fetchText(url);
}

/** Live scrape of one cinema. A parser that finds nothing throws: 0 rows is an error, not a success. */
export async function scrape(id: CinemaId, now = new Date()): Promise<Screening[]> {
  const def = SCRAPERS[id];
  const rows = sanitize(def.parse(await readSource(def), now));
  if (rows.length === 0) throw new Error(`${cinemaById(id).name}: 0 proiezioni lette`);
  return rows;
}

export const ALL_CINEMA_IDS = CINEMAS.map((c) => c.id);
