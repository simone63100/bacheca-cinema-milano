/**
 * pnpm scrape --dry [--city=bogota] → live scrape of one city (default milano), per-cinema report, nothing written.
 * pnpm scrape        → same, then the full daily pipeline (needs DATABASE_URL).
 * Exit code 1 if fewer than 11 cinemas return ≥1 future screening.
 */
import { cinemasIn } from "@/lib/cinemas";
import { CITIES } from "@/lib/cities";
import { minCinemasOk } from "@/lib/pipeline";
import { scrape } from "@/scrapers";
import type { Screening } from "@/lib/types";

const dry = process.argv.includes("--dry");
const cityArg = process.argv.find((a) => a.startsWith("--city="))?.slice(7) ?? "milano";
if (!CITIES.some((c) => c.id === cityArg)) throw new Error(`città sconosciuta: ${cityArg}`);
const CITY = cityArg as (typeof CITIES)[number]["id"];
const CINEMAS = cinemasIn(CITY);
const MIN_OK = minCinemasOk(CITY);

async function main() {
  const now = new Date();
  const results = await Promise.all(
    CINEMAS.map(async (c) => {
      const t0 = Date.now();
      try {
        const rows = await scrape(c.id, now);
        const future = rows.filter((r) => new Date(r.startsAt) > now);
        return { c, rows, future, ms: Date.now() - t0, error: null as string | null };
      } catch (e) {
        return { c, rows: [] as Screening[], future: [] as Screening[], ms: Date.now() - t0, error: (e as Error).message };
      }
    }),
  );

  console.log(`\nScrape ${dry ? "--dry " : ""}${now.toISOString()}\n`);
  for (const r of results) {
    const films = new Set(r.future.map((x) => x.title)).size;
    const status = r.future.length > 0 ? "OK " : "0  ";
    console.log(
      `${status} ${r.c.name.padEnd(26)} ${String(r.future.length).padStart(4)} proiezioni future, ${String(films).padStart(3)} film  (${r.ms} ms)${r.error ? `  ← ${r.error}` : ""}`,
    );
  }
  const ok = results.filter((r) => r.future.length > 0).length;
  const zero = results.filter((r) => r.future.length === 0).map((r) => r.c.name);
  console.log(`\n${ok}/${CINEMAS.length} sale con ≥1 proiezione futura (soglia ${MIN_OK}).`);
  if (zero.length) console.log(`A zero: ${zero.join(", ")}`);

  if (!dry) {
    const { runDaily } = await import("@/lib/pipeline");
    await runDaily({ city: CITY, now, scraped: results.map((r) => ({ cinemaId: r.c.id, rows: r.rows, error: r.error })) });
  }
  process.exit(ok >= MIN_OK ? 0 : 1);
}

main();
