/** Helper for hand-labelling: prints TMDB candidates (title, year, directors) for each printed title. */
import { tmdb } from "@/lib/tmdb";
import { titleVariants } from "@/lib/match";
const titles: [string, string][] = JSON.parse(process.argv[2]);
for (const [t, dir] of titles) {
  const seen = new Map<number, { id: number; title: string; original_title: string; release_date?: string }>();
  for (const v of titleVariants(t)) for (const c of (await tmdb.search(v)).slice(0, 4)) seen.set(c.id, c);
  const rows = await Promise.all([...seen.values()].slice(0, 6).map(async (c) => `${c.id} ${c.original_title} (${c.release_date?.slice(0, 4)}) [${(await tmdb.directors(c.id)).join(", ")}]`));
  console.log(`\n# ${t} | ${dir}\n  ${rows.join("\n  ")}`);
}
