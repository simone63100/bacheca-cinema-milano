/**
 * Cine Colombia (Vista platform). One site = one cinema (Santafé = site 6659).
 * Step 1: the cinema page embeds, in its Next payload, the Spanish film titles and which films
 * play on which business date (`filmScreeningDates`). Step 2: times come from
 * /api/v1/films/{film}/showtimes?site_ids={site}&date={day}, one polite request per film/day pair.
 * The bundle of both is what tests run on (scrapers/__fixtures__/cine-colombia-santafe.json).
 */
import type { CinemaId, Screening } from "@/lib/types";
import { USER_AGENT } from "./_http";

export interface CcBundle {
  page: string;
  /** API responses, one per film/day pair. */
  showtimes: CcShowtimesResponse[];
}

interface CcShowtime {
  start_time: string;
  is_sold_out?: boolean;
  film_id: string;
  attribute_ids: string[];
  screen_name?: string;
}
interface CcShowtimesResponse {
  sites: { showtimes: CcShowtime[] }[];
  related_data?: { attributes?: { id: string; name: string; kind?: string }[] };
}

/** Next.js flight payload: JSON lives inside JS strings, quotes escaped. */
function unescapePayload(html: string): string {
  return html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/** The JSON value (array or object) that follows `"key":` at its first occurrence. */
function jsonAfter(text: string, key: string): unknown {
  const at = text.indexOf(`"${key}":`);
  if (at < 0) return null;
  let i = at + key.length + 3;
  const open = text[i];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) return null;
  let depth = 0;
  let inStr = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inStr) {
      if (ch === "\\") j++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      try {
        return JSON.parse(text.slice(i, j + 1));
      } catch {
        return null;
      }
    }
  }
  i = -1;
  return null;
}

export interface SitePlan {
  /** film id → Spanish title as printed, and the original (usually English) title. */
  titles: Map<string, { es: string; original: string }>;
  pairs: { filmId: string; date: string }[];
}

export function parseSitePage(html: string, siteId: string): SitePlan {
  const text = unescapePayload(html);
  const titles: SitePlan["titles"] = new Map();
  for (const m of text.matchAll(/"id":"(HO\d+)","title":"((?:[^"\\]|\\.)*)","titleEs":"((?:[^"\\]|\\.)*)"/g)) {
    titles.set(m[1], { es: (m[3] || m[2]).trim(), original: m[2].trim() });
  }
  const dates = (jsonAfter(text, "filmScreeningDates") ?? []) as {
    businessDate: string;
    filmScreenings: { filmId: string; sites: { siteId: string }[] }[];
  }[];
  const pairs: SitePlan["pairs"] = [];
  for (const d of dates) {
    for (const fs of d.filmScreenings ?? []) {
      if (fs.sites?.some((s) => s.siteId === siteId)) pairs.push({ filmId: fs.filmId, date: d.businessDate });
    }
  }
  return { titles, pairs };
}

export function parseBundle(bundle: CcBundle, cinemaId: CinemaId, siteId: string, pageUrl: string): Screening[] {
  const { titles } = parseSitePage(bundle.page, siteId);
  const out: Screening[] = [];
  for (const res of bundle.showtimes) {
    const attrs = new Map((res.related_data?.attributes ?? []).map((a) => [a.id, a.name.toLowerCase()]));
    for (const site of res.sites ?? []) {
      for (const st of site.showtimes ?? []) {
        const t = titles.get(st.film_id);
        if (!t || !st.start_time) continue;
        const names = st.attribute_ids.map((id) => attrs.get(id) ?? "");
        out.push({
          cinemaId,
          title: t.es,
          ...(t.original && t.original !== t.es ? { originalTitle: t.original } : {}),
          startsAt: new Date(st.start_time).toISOString(),
          vo: names.includes("subtitulado"),
          special: false,
          url: pageUrl,
        });
      }
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Live read: the page, then one request per film/day pair (first 7 days), 700 ms apart. */
export async function fetchBundle(pageUrl: string, siteId: string, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<CcBundle> {
  const headers = { "user-agent": USER_AGENT, "accept-language": "es-CO,es;q=0.9" };
  const pageRes = await fetchImpl(pageUrl, { headers, signal: AbortSignal.timeout(20_000) });
  if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status} su ${pageUrl}`);
  const page = await pageRes.text();
  const until = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const pairs = parseSitePage(page, siteId).pairs.filter((p) => p.date >= today && p.date <= until);
  const origin = new URL(pageUrl).origin;
  const showtimes: CcShowtimesResponse[] = [];
  for (const p of pairs) {
    await sleep(700);
    const r = await fetchImpl(`${origin}/api/v1/films/${encodeURIComponent(p.filmId)}/showtimes?site_ids=${siteId}&date=${p.date}`, {
      headers: { ...headers, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (r.ok) showtimes.push((await r.json()) as CcShowtimesResponse);
  }
  return { page, showtimes };
}
