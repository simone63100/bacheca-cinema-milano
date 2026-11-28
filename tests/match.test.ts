import { describe, expect, it } from "vitest";
import { normalizeTitle, titleSimilarity, titleVariants } from "@/lib/match";

describe("similarità dei titoli", () => {
  it("articoli e preposizioni da soli non avvicinano due titoli", () => {
    // Wajda: "La caza de las moscas" non è "Paisaje después de la batalla"
    expect(titleSimilarity("La caza de las moscas", "Paisaje después de la batalla")).toBe(0);
    expect(titleSimilarity("La tierra prometida", "Tierra prometida")).toBe(1);
  });

  it("numeri scritti e in cifre coincidono", () => {
    expect(normalizeTitle("Dune - Parte due")).toBe(normalizeTitle("Dune: Parte 2"));
  });

  it("il titolo originale fra parentesi è una variante", () => {
    expect(titleVariants("Pulse (Kairo)")).toEqual(expect.arrayContaining(["Pulse", "Kairo"]));
  });
});
