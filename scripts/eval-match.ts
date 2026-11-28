/**
 * pnpm eval:match — TMDB matching on 40 hand-labelled titles from the cinemas (eval/match-set.json).
 * pnpm eval:bogota — 31 titles from Bogotá (eval/match-set-bogota.json), searched in es-CO.
 * "No match" counts as wrong, except for items labelled null (programmes of shorts: any match is wrong).
 * Exit 1 below 90%.
 */
import { readFileSync } from "node:fs";
import { matchTitle } from "@/lib/match";

interface Item {
  title: string;
  director?: string;
  year?: number;
  originalTitle?: string;
  cinema: string;
  tmdbId: number | null;
}

const THRESHOLD = 0.9;
const file = process.argv[2] ?? "eval/match-set.json";
const PRINTED = "2026-11-20T09:00:00Z"; // default: date the Milan titles were printed

async function main() {
  const set = JSON.parse(readFileSync(file, "utf8")) as { items: Item[]; lang?: "it-IT" | "es-CO"; region?: "IT" | "CO"; now?: string };
  const { items } = set;
  const now = new Date(set.now ?? PRINTED);
  const min = file.includes("holdout") ? 10 : file.includes("bogota") ? 20 : 40;
  if (items.length < min) throw new Error(`set troppo piccolo: ${items.length}`);
  const results = await Promise.all(
    items.map(async (it) => ({ it, r: await matchTitle({ title: it.title, originalTitle: it.originalTitle, director: it.director, year: it.year, now, lang: set.lang, region: set.region }) })),
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
