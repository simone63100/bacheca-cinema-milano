/**
 * pnpm eval:match — TMDB matching on 40 hand-labelled titles from the cinemas (eval/match-set.json).
 * "No match" counts as wrong. Exit 1 below 90%.
 */
import { readFileSync } from "node:fs";
import { matchTitle } from "@/lib/match";

interface Item {
  title: string;
  director?: string;
  year?: number;
  cinema: string;
  tmdbId: number;
}

const THRESHOLD = 0.9;
const file = process.argv[2] ?? "eval/match-set.json";
const NOW = new Date("2026-11-20T09:00:00Z"); // date the titles were printed

async function main() {
  const { items } = JSON.parse(readFileSync(file, "utf8")) as { items: Item[] };
  const min = file.includes("holdout") ? 10 : 40;
  if (items.length < min) throw new Error(`set troppo piccolo: ${items.length}`);
  const results = await Promise.all(
    items.map(async (it) => ({ it, r: await matchTitle({ title: it.title, director: it.director, year: it.year, now: NOW }) })),
  );
  let ok = 0;
  for (const { it, r } of results) {
    const good = r.tmdbId === it.tmdbId;
    if (good) ok++;
    else
      console.log(
        `✗ ${it.title} [${it.cinema}] atteso ${it.tmdbId}, ottenuto ${r.tmdbId ?? "nessuno"}` +
          (r.candidate ? ` (miglior candidato: ${r.candidate.title} ${r.candidate.release_date?.slice(0, 4) ?? ""}, score ${r.score.toFixed(1)})` : ""),
      );
  }
  const acc = ok / items.length;
  console.log(`\neval:match ${ok}/${items.length} = ${(acc * 100).toFixed(1)}% (soglia ${THRESHOLD * 100}%)`);
  process.exit(acc >= THRESHOLD ? 0 : 1);
}

main();
