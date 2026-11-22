/**
 * Glow colour behind the centre poster ("alone", TODO.md): the poster's dominant colour,
 * computed once in the daily pipeline and stored on the film. Doing it in the browser would
 * need a CORS-clean canvas on third-party images; here it is a 92px JPEG decoded in plain JS.
 */
import jpeg from "jpeg-js";

export const FALLBACK_ACCENT = "#f08a1f";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Dominant hue weighted by saturation, ignoring near-black/near-white pixels, then lifted to a
 * glow-friendly lightness. Returns null when the poster is essentially grey (caller falls back).
 */
export function dominantColor(rgba: Uint8Array, width: number, height: number): string | null {
  const buckets = new Array(36).fill(0).map(() => ({ w: 0, h: 0, s: 0 }));
  let coloured = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const [h, s, l] = rgbToHsl(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (l < 0.12 || l > 0.9 || s < 0.35) continue;
    coloured++;
    const b = buckets[Math.floor(h / 10) % 36];
    const w = s * s * (1 - Math.abs(l - 0.5));
    b.w += w;
    b.h += h * w;
    b.s += s * w;
  }
  if (coloured < total * 0.04) return null;
  // smooth over neighbouring buckets so a hue split across two buckets still wins
  let best = 0;
  let bestW = -1;
  for (let i = 0; i < 36; i++) {
    const w = buckets[i].w + 0.5 * (buckets[(i + 35) % 36].w + buckets[(i + 1) % 36].w);
    if (w > bestW) {
      bestW = w;
      best = i;
    }
  }
  const b = buckets[best];
  if (b.w === 0) return null;
  const hue = b.h / b.w;
  const sat = Math.max(0.55, Math.min(0.9, b.s / b.w));
  return hslToHex(hue, sat, 0.55);
}

/** TMDB serves sized variants: a 92px poster is plenty for one colour. */
export function smallPosterUrl(poster: string): string {
  return poster.replace(/image\.tmdb\.org\/t\/p\/w\d+\//, "image.tmdb.org/t/p/w92/");
}

/** Colour, `null` when the poster has none (grey: use the fallback), or "retry" when the fetch failed. */
export async function posterAccent(poster: string, fetchImpl: typeof fetch = fetch): Promise<string | null | "retry"> {
  let r: Response;
  try {
    r = await fetchImpl(smallPosterUrl(poster), { signal: AbortSignal.timeout(10_000) });
  } catch {
    return "retry";
  }
  if (r.status >= 500 || r.status === 429) return "retry";
  try {
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // JPEG only
    const img = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 4, maxMemoryUsageInMB: 64 });
    return dominantColor(img.data, img.width, img.height);
  } catch {
    return null;
  }
}
