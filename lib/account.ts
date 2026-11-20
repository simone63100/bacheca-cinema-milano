"use server";
import { revalidatePath } from "next/cache";
import { auth } from "./auth/server";
import { q } from "./db";
import { saveEntries } from "./lbsync";
import { USERNAME_RE, parseCsv, type LbKind } from "./letterboxd";

async function currentUser() {
  const { data } = await auth().getSession();
  const u = data?.user;
  if (!u?.id || !u.email) throw new Error("Accesso richiesto");
  await q("INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email", [u.id, u.email]);
  return { id: u.id, email: u.email };
}

export interface SaveState {
  ok: boolean;
  message: string;
}

export async function saveSettings(_prev: SaveState, form: FormData): Promise<SaveState> {
  const u = await currentUser();
  const username = String(form.get("letterboxd") ?? "").trim().replace(/^@/, "");
  if (username && !USERNAME_RE.test(username)) return { ok: false, message: "Username Letterboxd non valido." };
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const radius = Number(form.get("radius"));
  const validPos = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat - 45.46) < 0.5 && Math.abs(lng - 9.19) < 0.5;
  if (!validPos) return { ok: false, message: "Scegli una posizione a Milano." };
  if (!(radius >= 1 && radius <= 30)) return { ok: false, message: "Raggio fra 1 e 30 km." };
  const prev = await q<{ letterboxd_username: string | null }>("SELECT letterboxd_username FROM users WHERE id = $1", [u.id]);
  const changed = (prev[0]?.letterboxd_username ?? "") !== username;
  await q(
    `UPDATE users SET letterboxd_username = $2, lat = $3, lng = $4, radius_km = $5,
       letterboxd_synced_at = CASE WHEN $6 THEN NULL ELSE letterboxd_synced_at END
     WHERE id = $1`,
    [u.id, username || null, lat, lng, radius, changed],
  );
  revalidatePath("/account");
  return { ok: true, message: username ? "Salvato. La watchlist si aggiorna una volta al giorno, all'alba." : "Salvato." };
}

export async function uploadCsv(_prev: SaveState, form: FormData): Promise<SaveState> {
  const u = await currentUser();
  const file = form.get("csv");
  const kind = String(form.get("kind")) as LbKind;
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Scegli un file CSV." };
  if (file.size > 2_000_000) return { ok: false, message: "File troppo grande (max 2 MB)." };
  if (!["watchlist", "seen"].includes(kind)) return { ok: false, message: "Tipo di lista non valido." };
  try {
    const entries = parseCsv(await file.text(), kind);
    await saveEntries(u.id, entries, [kind]);
    revalidatePath("/account");
    return { ok: true, message: `${entries.length} film importati.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteAccount(): Promise<void> {
  const u = await currentUser();
  await q("DELETE FROM users WHERE id = $1", [u.id]);
}
