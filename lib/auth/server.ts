import { createNeonAuth } from "@neon/auth/next/server";

let instance: ReturnType<typeof createNeonAuth> | null = null;

/** Lazily created: env vars are only available per request on Workers. */
export function auth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (!baseUrl || !secret) throw new Error("NEON_AUTH_BASE_URL / NEON_AUTH_COOKIE_SECRET mancanti");
    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }
  return instance;
}
