import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { likelyMatches, parseCsv, parseFilmTmdbId, parseGrid, readProfile } from "@/lib/letterboxd";

const fx = (f: string) => readFileSync(path.join(__dirname, "..", "lib", "__fixtures__", f), "utf8");

describe("Letterboxd", () => {
  it("legge la griglia della watchlist (nome, anno, slug, paginazione)", () => {
    const { entries, lastPage } = parseGrid(fx("letterboxd-watchlist.html"), "watchlist");
    expect(entries).toHaveLength(8);
    expect(entries[0]).toEqual({ slug: "fjord-2026", name: "Fjord", year: 2026, kind: "watchlist", stars: null });
    expect(entries.find((e) => e.slug === "2001-a-space-odyssey")?.name).toBe("2001: A Space Odyssey");
    expect(lastPage).toBe(2);
  });

  it("legge l'id TMDB dalla pagina del film", () => {
    expect(parseFilmTmdbId(fx("letterboxd-film.html"))).toBe(1401459);
  });

  it("legge l'export CSV (virgolette, virgole nei titoli, voti)", () => {
    const csv = 'Date,Name,Year,Letterboxd URI,Rating\n2026-01-02,"Crouching Tiger, Hidden Dragon",2000,https://boxd.it/x,4.5\n2026-01-03,Blow-Up,1966,https://boxd.it/y,5\n';
    const rows = parseCsv(csv, "seen");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Crouching Tiger, Hidden Dragon", year: 2000, stars: 4.5 });
  });

  it("pre-filtro: lega solo le voci che somigliano ai film in sala", () => {
    const { entries } = parseGrid(fx("letterboxd-watchlist.html"), "watchlist");
    const films = [
      { tmdbId: 1401459, title: "Fjord", originalTitle: "Fjord", year: 2026 },
      { tmdbId: 62, title: "2001: Odissea nello spazio", originalTitle: "2001: A Space Odyssey", year: 1968 },
      { tmdbId: 5, title: "Dio ride", originalTitle: "Dio ride", year: 2026 },
    ];
    const m = likelyMatches(entries, films);
    expect(m.map((x) => x.film.tmdbId).sort()).toEqual([1401459, 62].sort());
  });

  it("si ferma al primo 403 (challenge) senza riprovare e tiene quello che ha letto", async () => {
    const watchlist = fx("letterboxd-watchlist.html");
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/watchlist/")) return new Response(watchlist, { status: 200 });
      return new Response("<title>Just a moment...</title>", { status: 403 });
    });
    const r = await readProfile("test", { delayMs: 0, fetchImpl: fetchImpl as typeof fetch });
    expect(r.complete).toBe(false);
    expect(r.entries.filter((e) => e.kind === "watchlist")).toHaveLength(8);
    // watchlist p1 + watchlist p2 (403) → stop; ratings and profile never requested
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rifiuta username non validi (niente path injection)", async () => {
    await expect(readProfile("../admin")).rejects.toThrow();
  });
});
