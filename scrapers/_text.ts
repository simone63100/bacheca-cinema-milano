const VO_PATTERNS = [
  /\bv\.?\s?o\.?\s*(sott\.?\s*(ita(liano)?)?)?\b\.?/gi,
  /\bversione originale( con sottotitoli( in italiano)?)?/gi,
  /\blingua originale( sott\.? italiano)?/gi,
  /\|\s*film in [a-zà-ù]+/gi,
];

/**
 * Event tags are only stripped at the start or end of the printed title: "L'INCONTRO" or
 * "Peccato originale" are titles, "ANTEPRIMA. EVENTO 10 FJORD" is a tag plus a title.
 */
const EDGE_PATTERNS = [
  /anteprima/,
  /evento(\s*\d+)?/,
  /ospiti in sala/,
  /regista in sala/,
  /incontro/,
  /introduzione/,
  /versione restaurata/,
  /restaur(o|ato|ata|ati)/,
  /ried(\.|izione)?(\s*\d{4})?/,
  /cinemino classics/,
  /longtake film festival( \d{4})?/,
];

function stripEdges(t: string): string {
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of EDGE_PATTERNS) {
      // the tag must be a whole word bounded by spaces/separators: "L'INCONTRO" is not a tag
      const head = new RegExp(`^\\s*(?:${p.source})(?:[\\s.:\\-–|]+|$)`, "i");
      const tail = new RegExp(`[\\s.:\\-–|(]+(?:${p.source})\\.?\\)?\\s*$`, "i");
      const next = t.replace(head, "").replace(tail, "");
      if (next !== t && next.trim()) {
        t = next;
        changed = true;
      }
    }
  }
  return t;
}

const SPECIAL_HINT = /(anteprima|evento|ospit|regista in sala|incontro|introduzione|restaur|ried|classics|festival)/i;
const VO_HINT = /(\bv\.?\s?o\b|versione originale|lingua originale|film in (inglese|francese|norvegese|spagnolo|tedesco|giapponese|coreano|[a-z]+ese)|sott\.? ?ita)/i;

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Normalises a printed title: strips V.O./event tags, fixes case, reports flags. */
export function cleanTitle(raw: string): { title: string; vo: boolean; special: boolean } {
  let t = decodeEntities(raw).replace(/\s+/g, " ").trim();
  const vo = VO_HINT.test(t);
  const special = SPECIAL_HINT.test(t);
  for (const p of VO_PATTERNS) t = t.replace(p, " ");
  t = stripEdges(t.replace(/\s+/g, " ").trim());
  t = t.replace(/^\s*new!\s*/i, "").replace(/\[\s*\d{4}\s*\]/g, " ");
  t = t
    .replace(/\(\s*\)/g, " ")
    .replace(/\s*[-–|:]\s*$/g, "")
    .replace(/^\s*[-–|:.]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title: smartCase(t), vo, special };
}

const SMALL = new Set(["di", "a", "da", "in", "con", "su", "per", "tra", "fra", "e", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "del", "della", "dei", "delle", "nel", "nella", "the", "of", "and", "de", "des", "du", "el", "y"]);

/** ALL CAPS → Title case (Italian style: only first word and proper words). Mixed case is kept. */
export function smartCase(t: string): string {
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower
    .split(" ")
    .map((w, i) => {
      if (i > 0 && SMALL.has(w)) return w;
      // keep roman numerals / acronyms short: II, III, IV, XXX, USA
      if (/^(i{1,3}|iv|v|vi{1,3}|ix|x{1,3}|usa|uk)$/.test(w) && i > 0) return w.toUpperCase();
      return w.replace(/(^|['’(-])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase());
    })
    .join(" ");
}

export function parseHourMinute(s: string): { h: number; min: number } | null {
  const m = s.match(/(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}
