import type { Screening } from "@/lib/types";
import { monthFromItalian, romeToIso } from "@/lib/time";
import { cleanTitle } from "./_text";

const DAY_RE = /^(LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ|SABATO|DOMENICA)\s+(\d{1,2})\s+([A-ZÀ-Ù]+)\s*$/;
const ENTRY_RE = /^(\d{1,2}):(\d{2})\s+(.*)$/;
const SPECIAL_TAGS = /#(anteprima|classici|nocturna|studio|ad|lk|supernova|human)/i;
const MONTH_YEAR_RE =
  /\b(GENNAIO|FEBBRAIO|MARZO|APRILE|MAGGIO|GIUGNO|LUGLIO|AGOSTO|SETTEMBRE|OTTOBRE|NOVEMBRE|DICEMBRE)\s+(\d{4})\b/;

/**
 * Fondazione Prada answers the website with a Cloudflare challenge (403), but the monthly PDF
 * programme under /wp-content/uploads is public. We read its calendar pages
 * ("PROGRAMMA DELLE PROIEZIONI"): a day header, then "HH:MM Title – Director #Tag",
 * sometimes wrapped over several lines.
 */
export function parseProgrammeText(text: string, pageUrl: string): Screening[] {
  const ym = text.match(MONTH_YEAR_RE);
  if (!ym) throw new Error("Godard: mese/anno del programma non trovati");
  const progMonth = monthFromItalian(ym[1]);
  const progYear = Number(ym[2]);
  const start = text.search(/PROGRAMMA DELLE\s+PROIEZIONI/);
  if (start < 0) throw new Error("Godard: calendario delle proiezioni non trovato");
  const lines = text
    .slice(start)
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const out: Screening[] = [];
  let day: { y: number; m: number; d: number } | null = null;
  let cur: { h: number; min: number; text: string } | null = null;

  const flush = () => {
    if (!cur || !day) {
      cur = null;
      return;
    }
    const tagMatch = cur.text.match(/#\S+/);
    const body = (tagMatch ? cur.text.slice(0, tagMatch.index) : cur.text).trim();
    const tag = tagMatch?.[0] ?? "";
    const sep = body.lastIndexOf(" – ");
    const rawTitle = sep > 0 ? body.slice(0, sep) : body;
    const director = sep > 0 ? body.slice(sep + 3).trim() : undefined;
    if (!/^incontro con/i.test(rawTitle)) {
      const { title, special } = cleanTitle(rawTitle);
      out.push({
        cinemaId: "godard",
        title,
        startsAt: romeToIso(day.y, day.m, day.d, cur.h, cur.min),
        vo: true, // il Godard proietta in lingua originale con sottotitoli
        special: special || SPECIAL_TAGS.test(tag),
        url: pageUrl,
        director,
      });
    }
    cur = null;
  };

  for (const line of lines) {
    const dm = line.toUpperCase().match(DAY_RE);
    if (dm) {
      flush();
      const m = monthFromItalian(dm[3]);
      day = { y: m < progMonth - 6 ? progYear + 1 : progYear, m, d: Number(dm[2]) };
      continue;
    }
    const em = line.match(ENTRY_RE);
    if (em) {
      flush();
      cur = { h: Number(em[1]), min: Number(em[2]), text: em[3] };
      if (/#\S+/.test(cur.text)) flush();
      continue;
    }
    if (cur) {
      cur.text = `${cur.text} ${line}`.replace(/(\p{L})- (\p{L})/gu, "$1-$2");
      if (/#\S+/.test(line)) flush();
    }
  }
  flush();
  return out;
}

export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).join("\n");
}
