import { describe, expect, it } from "vitest";
import { dominantColor, smallPosterUrl } from "@/lib/accent";

function image(pixels: [number, number, number][], w: number, h: number) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = pixels[i % pixels.length];
    data.set([r, g, b, 255], i * 4);
  }
  return data;
}

const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

describe("alone dal colore della locandina", () => {
  it("un manifesto blu con qualche volto: vince il blu, non l'incarnato", () => {
    const blue: [number, number, number] = [20, 60, 200];
    const skin: [number, number, number] = [210, 160, 130];
    const data = image([blue, blue, blue, skin], 40, 60);
    const c = dominantColor(data, 40, 60)!;
    expect(hue(c)).toBeGreaterThan(200);
    expect(hue(c)).toBeLessThan(250);
  });

  it("una locandina in bianco e nero non ha colore (fallback arancio a valle)", () => {
    const data = image([[10, 10, 10], [240, 240, 240], [128, 128, 128]], 30, 30);
    expect(dominantColor(data, 30, 30)).toBeNull();
  });

  it("chiede a TMDB la variante da 92px", () => {
    expect(smallPosterUrl("https://image.tmdb.org/t/p/w500/abc.jpg")).toBe("https://image.tmdb.org/t/p/w92/abc.jpg");
  });
});
