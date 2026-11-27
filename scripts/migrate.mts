/** pnpm db:migrate — applies db/schema.sql and seeds the 13 cinemas. Idempotent. */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CINEMAS } from "@/lib/cinemas";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL mancante (.env.local)");
const sql = neon(url);

const statements = readFileSync("db/schema.sql", "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const s of statements) await sql.query(s);
for (const c of CINEMAS) {
  await sql.query(
    `INSERT INTO cinemas (id, name, lat, lng, url, city) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng, url = EXCLUDED.url, city = EXCLUDED.city`,
    [c.id, c.name, c.lat, c.lng, c.url, c.city],
  );
}
const [{ n }] = (await sql.query("SELECT count(*)::int AS n FROM cinemas")) as { n: number }[];
console.log(`schema applicato (${statements.length} statement), ${n} sale`);
