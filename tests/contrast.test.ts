import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** WCAG 2 contrast on the real tokens in app/globals.css (TODO.md: AA on sabbia/bianco su nero e su arancio). */
const css = readFileSync(path.join(__dirname, "..", "app", "globals.css"), "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`token --${name} non trovato`);
  return m[1];
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("contrasto AA dei token", () => {
  const pairs: [string, string][] = [
    ["text", "bg"],
    ["sand", "bg"],
    ["orange", "bg"],
    ["text", "panel"],
    ["sand", "panel"],
    ["orange", "panel"],
    ["on-orange", "orange"],
  ];
  for (const [fg, bg] of pairs) {
    it(`${fg} su ${bg} ≥ 4.5:1`, () => {
      expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("il bianco caldo su arancio NON passa: per questo il testo sui bottoni arancio è nero", () => {
    expect(ratio(token("text"), token("orange"))).toBeLessThan(4.5);
  });
});
