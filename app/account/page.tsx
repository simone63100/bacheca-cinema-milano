import type { Metadata } from "next";
import { AccountView, SignIn } from "@/components/AccountView";
import { auth } from "@/lib/auth/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Impostazioni · Bijoux" };

export default async function AccountPage() {
  const { data } = await auth().getSession();
  const user = data?.user;
  if (!user?.id || !user.email) return <SignIn />;

  await q("INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email", [user.id, user.email]);
  const [row] = await q<{ letterboxd_username: string | null; lat: number | null; lng: number | null; radius_km: number; letterboxd_synced_at: string | null; wl: string; rated: string }>(
    `SELECT u.letterboxd_username, u.lat, u.lng, u.radius_km, u.letterboxd_synced_at,
            (SELECT count(*) FROM lb_entries e WHERE e.user_id = u.id AND e.kind = 'watchlist') AS wl,
            (SELECT count(*) FROM lb_entries e WHERE e.user_id = u.id AND e.kind = 'seen') AS rated
     FROM users u WHERE u.id = $1`,
    [user.id],
  );
  return (
    <AccountView
      data={{
        email: user.email,
        letterboxd: row.letterboxd_username,
        lat: row.lat,
        lng: row.lng,
        radiusKm: row.radius_km,
        watchlist: Number(row.wl),
        rated: Number(row.rated),
        syncedAt: row.letterboxd_synced_at ? new Date(row.letterboxd_synced_at).toISOString() : null,
      }}
    />
  );
}
