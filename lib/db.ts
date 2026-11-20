import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: { url: string; sql: NeonQueryFunction<false, false> } | null = null;

/** HTTP driver: works in Workers, Node and Neon Functions without a pool. */
export function db(url = process.env.DATABASE_URL): NeonQueryFunction<false, false> {
  if (!url) throw new Error("DATABASE_URL mancante");
  if (cached?.url !== url) cached = { url, sql: neon(url) };
  return cached.sql;
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}
