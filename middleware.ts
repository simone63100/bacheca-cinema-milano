import type { NextRequest } from "next/server";
import { createNeonAuth } from "@neon/auth/next/server";

/**
 * Only for /account: back from Google, Neon Auth appends ?neon_auth_session_verifier=…, and this
 * middleware exchanges it for the session cookie. /account stays public (it shows the sign-in form),
 * and loginUrl must NOT be /account: the SDK skips the exchange on its own login page.
 */
export async function middleware(request: NextRequest) {
  const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
  return auth.middleware({ loginUrl: "/accedi", publicRoutes: ["/account"] })(request);
}

export const config = { matcher: ["/account"] };
