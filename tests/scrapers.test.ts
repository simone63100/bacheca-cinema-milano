import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CINEMAS } from "@/lib/cinemas";
import { SCRAPERS, sanitize } from "@/scrapers";
import { pdfToText } from "@/scrapers/godard";
import { cleanTitle } from "@/scrapers/_text";

/** Fixtures were saved on 2026-11-20 (Milan) — parsers that depend on "today" use that date. */
const FIXTURE_NOW = new Date("2026-11-20T09:00:00Z");
const dir = path.join(__dirname, "..", "scrapers", "__fixtures__");

async function load(fixture: string, format: "text" | "pdf" | "cine-colombia") {
  const buf = readFileSync(path.join(dir, fixture));
  return format === "pdf" ? pdfToText(new Uint8Array(buf)) : buf.toString("utf8");
}

describe("cleanTitle", () => {
  it("toglie le etichette in testa e in coda, non dentro il titolo", () => {
    expect(cleanTitle("ANTEPRIMA. EVENTO 10 V.O. SOTT. ITA YOU CAN SEE EVERYTHING")).toMatchObject({ title: "You Can See Everything", vo: true, special: true });
    expect(cleanTitle("L'INCONTRO").title).toBe("L'Incontro");
    expect(cleanTitle("Peccato originale").title).toBe("Peccato originale");
    expect(cleanTitle("FJORD | FILM IN NORVEGESE")).toMatchObject({ title: "Fjord", vo: true });
    expect(cleanTitle("Pinocchio (Ried.)").title).toBe("Pinocchio");
    expect(cleanTitle("NEW! DUNE PARTE TRE | ANTEPRIMA").title).toBe("Dune Parte Tre");
  });
});

describe("scraper delle 13 sale su fixture", () => {
  it("copre esattamente le 13 sale", () => {
    expect(Object.keys(SCRAPERS).sort()).toEqual(CINEMAS.map((c) => c.id).sort());
    expect(CINEMAS.filter((c) => c.city === "milano")).toHaveLength(13);
  });

  for (const def of Object.values(SCRAPERS)) {
    it(`${def.id}: ≥1 proiezione con titolo, data, ora e sala`, async () => {
      const rows = sanitize(def.parse(await load(def.fixture, def.format), FIXTURE_NOW));
      expect(rows.length, `${def.id} ha restituito 0 righe`).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.cinemaId).toBe(def.id);
        expect(r.title.trim().length).toBeGreaterThan(0);
        expect(r.title).not.toMatch(/v\.\s?o\.|sott\.?\s?ita/i);
        const t = new Date(r.startsAt);
        expect(Number.isNaN(t.getTime())).toBe(false);
        // listings are for this period, not garbage years
        expect(t.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
        expect(t.getTime()).toBeLessThan(Date.UTC(2027, 6, 1));
      }
    });
  }

  it("godard: legge Fjord il 20/11 alle 20:30 (ora di Milano)", async () => {
    const rows = SCRAPERS.godard.parse(await load("godard.pdf", "pdf"), FIXTURE_NOW);
    const fjord = rows.find((r) => r.title === "Fjord" && r.startsAt === "2026-11-20T19:30:00.000Z");
    expect(fjord?.director).toBe("Cristian Mungiu");
    expect(rows.some((r) => r.title.startsWith("D.O.A."))).toBe(true);
  });

  it("palestrina: Fjord doppiato ven 20 alle 18:00, in v.o. lun 23 alle 21:00", async () => {
    const rows = SCRAPERS.palestrina.parse(await load("palestrina.html", "text"), FIXTURE_NOW);
    const fri = rows.find((r) => r.title === "Fjord" && r.startsAt === "2026-11-20T17:00:00.000Z");
    const mon = rows.find((r) => r.title === "Fjord" && r.startsAt === "2026-11-23T20:00:00.000Z");
    expect(fri?.vo).toBe(false);
    expect(mon?.vo).toBe(true);
  });

  it("cinemino: la vista settimanale resta in novembre fino al 30 e passa a dicembre dopo", async () => {
    const rows = SCRAPERS.cinemino.parse(await load("cinemino.html", "text"), FIXTURE_NOW);
    expect(rows.some((r) => r.startsAt.startsWith("2026-11-20"))).toBe(true);
    expect(rows.every((r) => r.startsAt >= "2026-11-19")).toBe(true);
  });

  it("cinemateca di Bogotá: orari nel fuso di Bogotá, solo da oggi in poi", async () => {
    const rows = sanitize(SCRAPERS["cinemateca-bogota"].parse(await load("cinemateca-bogota.html", "text"), FIXTURE_NOW));
    // "Pulse (Kairo)", Sala 2, Noviembre 28 8:00 pm → 01:00 UTC del 29 (Bogotá è UTC-5)
    const pulse = rows.find((r) => r.title === "Pulse (Kairo)");
    expect(pulse?.startsAt).toBe("2026-11-29T01:00:00.000Z");
    expect(rows.every((r) => r.startsAt >= "2026-11-20T05:00:00.000Z")).toBe(true);
    expect(rows.length).toBeGreaterThan(20);
  });

  it("cine colombia santafé: titoli in spagnolo, orari con il fuso della sede, v.o. dagli attributi", async () => {
    const rows = sanitize(SCRAPERS["cinecolombia-santafe"].parse(await load("cine-colombia-santafe.json", "cine-colombia"), FIXTURE_NOW));
    expect(rows.length).toBeGreaterThan(50);
    expect(rows.some((r) => /Juegos del Hambre/.test(r.title))).toBe(true);
    expect(rows.some((r) => r.vo)).toBe(true);
    expect(rows.some((r) => !r.vo)).toBe(true);
  });

  it("beltrade: scarta i segnaposto alle 06:00", async () => {
    const rows = sanitize(SCRAPERS.beltrade.parse(await load("beltrade.ics", "text"), FIXTURE_NOW));
    expect(rows.some((r) => /keep calm/i.test(r.title))).toBe(false);
  });
});
