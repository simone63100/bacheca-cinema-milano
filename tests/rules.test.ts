import { describe, expect, it } from "vitest";
import { evaluateUser, planMail, type FomoFilm, type FomoScreening, type FomoUser } from "@/lib/fomo";
import { freshness } from "@/lib/freshness";
import { distanceKm, withinRadius } from "@/lib/geo";
import { CINEMAS } from "@/lib/cinemas";

const NOW = new Date("2026-11-20T09:00:00Z");
const at = (days: number, hour = 20) => new Date(NOW.getTime() + days * 86_400_000 + (hour - 10) * 3_600_000).toISOString();

const cinemas = [
  { id: "near", lat: 45.4642, lng: 9.19 }, // Duomo
  { id: "far", lat: 45.5845, lng: 9.2744 }, // Monza, ~15 km
];
const user = (over: Partial<FomoUser> = {}): FomoUser => ({
  id: "u1",
  lat: 45.4654,
  lng: 9.1866,
  radiusKm: 5,
  lists: [],
  notified: new Set(),
  lastMailAt: null,
  ...over,
});
const film = (filmId: number, rerun = false): FomoFilm => ({ filmId, tmdbId: 1000 + filmId, title: `F${filmId}`, rerun });
const scr = (filmId: number, days: number, cinemaId = "near", special = false): FomoScreening => ({
  filmId,
  tmdbId: 1000 + filmId,
  cinemaId,
  startsAt: at(days),
  special,
});

describe("regole FOMO", () => {
  it("1. watchlist: scatta quando l'ultima proiezione nel raggio è entro 3 giorni", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    const screenings = [scr(1, 1), scr(1, 2), scr(1, 2.5), scr(1, 9, "far")];
    const hits = evaluateUser(u, [film(1)], screenings, cinemas, NOW);
    expect(hits.map((h) => h.rule)).toContain("watchlist_last");
  });

  it("1. watchlist: non scatta se c'è ancora una proiezione nel raggio fra più di 3 giorni (prima visione)", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    const hits = evaluateUser(u, [film(1)], [scr(1, 1), scr(1, 2), scr(1, 3), scr(1, 6)], cinemas, NOW);
    expect(hits.map((h) => h.rule)).not.toContain("watchlist_last");
  });

  it("1. watchlist: un film riproposto scatta subito, anche se l'ultima data è lontana", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    const hits = evaluateUser(u, [film(1, true)], [scr(1, 8), scr(1, 10), scr(1, 12)], cinemas, NOW);
    expect(hits.map((h) => h.rule)).toContain("watchlist_last");
  });

  it("1. watchlist: una sala che pubblica solo l'oggi non fa scattare 'ultime sere' su una prima visione", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    const partialCinemas = [{ ...cinemas[0], todayOnly: true }, cinemas[1]];
    const hits = evaluateUser(u, [film(1)], [scr(1, 0.3), scr(1, 0.4)], partialCinemas, NOW);
    expect(hits.map((h) => h.rule)).not.toContain("watchlist_last");
  });

  it("2. visti ≥4★: scatta solo su restauro/proiezione speciale", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "seen", stars: 4.5 }, { tmdbId: 1002, kind: "seen", stars: 4 }] });
    const screenings = [scr(1, 5, "near", true), scr(1, 6), scr(1, 7), scr(2, 5), scr(2, 6), scr(2, 7)];
    const hits = evaluateUser(u, [film(1), film(2)], screenings, cinemas, NOW);
    expect(hits.find((h) => h.filmId === 1)?.rule).toBe("loved_special");
    expect(hits.find((h) => h.filmId === 2)).toBeUndefined();
  });

  it("2. visti con 3★ non scattano neanche su restauro", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "seen", stars: 3 }] });
    const hits = evaluateUser(u, [film(1)], [scr(1, 5, "near", true), scr(1, 6), scr(1, 7)], cinemas, NOW);
    expect(hits).toHaveLength(0);
  });

  it("2. preferiti: scattano su proiezione speciale", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "favorite" }] });
    const hits = evaluateUser(u, [film(1)], [scr(1, 5, "near", true), scr(1, 6), scr(1, 7)], cinemas, NOW);
    expect(hits.map((h) => h.rule)).toEqual(["loved_special"]);
  });

  it("3. evento: film in lista con ≤2 proiezioni totali scatta subito", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "seen", stars: 2 }] });
    const hits = evaluateUser(u, [film(1)], [scr(1, 10), scr(1, 11, "far")], cinemas, NOW);
    expect(hits.map((h) => h.rule)).toEqual(["rare_event"]);
  });

  it("nessuna mail se nessun match", () => {
    const u = user({ lists: [{ tmdbId: 9999, kind: "watchlist" }] });
    const plan = planMail(evaluateUser(u, [film(1)], [scr(1, 1)], cinemas, NOW));
    expect(plan.send).toBe(false);
  });

  it("nessuna mail per film fuori raggio", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    expect(evaluateUser(u, [film(1)], [scr(1, 1, "far")], cinemas, NOW)).toHaveLength(0);
  });

  it("max 1 mail al giorno: se oggi è già partita una mail, niente", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }], lastMailAt: new Date(NOW.getTime() - 3_600_000).toISOString() });
    expect(evaluateUser(u, [film(1)], [scr(1, 1)], cinemas, NOW)).toHaveLength(0);
    const yesterday = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }], lastMailAt: new Date(NOW.getTime() - 86_400_000).toISOString() });
    expect(evaluateUser(yesterday, [film(1)], [scr(1, 1)], cinemas, NOW).length).toBeGreaterThan(0);
  });

  it("più film nello stesso giorno finiscono in UNA mail", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }, { tmdbId: 1002, kind: "watchlist" }] });
    const plan = planMail(evaluateUser(u, [film(1), film(2)], [scr(1, 1), scr(2, 2)], cinemas, NOW));
    expect(plan.send).toBe(true);
    expect(new Set(plan.hits.map((h) => h.filmId))).toEqual(new Set([1, 2]));
  });

  it("mai due volte lo stesso film per la stessa regola", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }], notified: new Set(["1|watchlist_last", "1|rare_event"]) });
    expect(evaluateUser(u, [film(1)], [scr(1, 1)], cinemas, NOW)).toHaveLength(0);
  });

  it("proiezioni già passate non contano", () => {
    const u = user({ lists: [{ tmdbId: 1001, kind: "watchlist" }] });
    expect(evaluateUser(u, [film(1)], [scr(1, -1)], cinemas, NOW)).toHaveLength(0);
  });
});

describe("filtro raggio", () => {
  const duomo = { lat: 45.4642, lng: 9.19 };

  it("distanza nota: Duomo → Fondazione Prada ≈ 2,3 km", () => {
    const godard = CINEMAS.find((c) => c.id === "godard")!;
    expect(distanceKm(duomo, godard)).toBeGreaterThan(2);
    expect(distanceKm(duomo, godard)).toBeLessThan(2.8);
  });

  it("3 km dal Duomo: dentro Arlecchino e Centrale, fuori MIC e Beltrade", () => {
    const ids = withinRadius(CINEMAS, duomo, 3).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["arlecchino", "centrale"]));
    expect(ids).not.toContain("mic");
    expect(ids).not.toContain("beltrade");
  });

  it("raggio grande include tutte le 13 sale", () => {
    expect(withinRadius(CINEMAS, duomo, 15)).toHaveLength(13);
  });
});

describe("guardia di freschezza", () => {
  const run = (hoursAgo: number) => ({ id: 7, finishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString() });

  it("run di 27h fa → banner + un avviso all'admin", () => {
    const s = freshness(run(27), NOW, null);
    expect(s.stale).toBe(true);
    expect(s.banner).toMatch(/^Dati del /);
    expect(s.alertAdmin).toBe(true);
  });

  it("run di 25h fa → niente banner, niente avviso", () => {
    const s = freshness(run(25), NOW, null);
    expect(s.stale).toBe(false);
    expect(s.banner).toBeNull();
    expect(s.alertAdmin).toBe(false);
  });

  it("un solo avviso per episodio: già avvisato per quel run → niente", () => {
    expect(freshness(run(50), NOW, 7).alertAdmin).toBe(false);
  });

  it("run riuscito stamattina → 'aggiornato oggi'", () => {
    expect(freshness(run(2), NOW, null).label).toBe("aggiornato oggi");
  });
});
