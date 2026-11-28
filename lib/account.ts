"use server";
import { CITIES, cityNear } from "./cities";
import { revalidatePath } from "next/cache";
import { auth } from "./auth/server";
import { q } from "./db";
import { saveEntries } from "./lbsync";
import { USERNAME_RE, csvKind, parseCsv, readProfile } from "./letterboxd";

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

/**
 * "Collega": checks the profile exists and reads the watchlist right away (a few pages, once,
 * because the user asked), so the page can say how many films it found.
 */
export async function connectLetterboxd(_prev: SaveState, form: FormData): Promise<SaveState> {
  const u = await currentUser();
  const raw = String(form.get("letterboxd") ?? "").trim();
  const username = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, "").replace(/\/.*$/, "");
  if (!username) {
    await q("UPDATE users SET letterboxd_username = NULL WHERE id = $1", [u.id]);
    await q("DELETE FROM lb_entries WHERE user_id = $1 AND kind = 'watchlist'", [u.id]);
    revalidatePath("/account");
    return { ok: true, message: "Letterboxd scollegato." };
  }
  if (!USERNAME_RE.test(username)) return { ok: false, message: "Questo non sembra uno username di Letterboxd." };

  const r = await readProfile(username, { watchlistOnly: true, delayMs: 1500, maxPages: 12 });
  if (r.notFound) return { ok: false, message: `Su Letterboxd non esiste un profilo "${username}". Controlla lo username: è quello nell'indirizzo del tuo profilo.` };

  await q("UPDATE users SET letterboxd_username = $2, letterboxd_synced_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id = $1", [u.id, username, r.complete]);
  if (r.entries.length || r.complete) await saveEntries(u.id, r.entries, ["watchlist"]);
  revalidatePath("/account");
  if (!r.complete && !r.entries.length) {
    return { ok: true, message: `Collegato a ${username}. Letterboxd ora non risponde: leggo la watchlist con l'aggiornamento di stanotte.` };
  }
  return { ok: true, message: `Collegato a ${username}: ${r.entries.length} film nella watchlist.` };
}

/** Position and radius save as soon as they change; the city follows the position. */
export async function savePlace(lat: number, lng: number, radius: number): Promise<SaveState> {
  const u = await currentUser();
  const city = Number.isFinite(lat) && Number.isFinite(lng) ? cityNear({ lat, lng }) : null;
  if (!city) return { ok: false, message: `La posizione deve essere in una di queste città: ${CITIES.map((c) => c.name).join(", ")}.` };
  if (!(radius >= 1 && radius <= 40)) return { ok: false, message: "Raggio fra 1 e 40 km." };
  await q("UPDATE users SET lat = $2, lng = $3, radius_km = $4, city = $5 WHERE id = $1", [u.id, lat, lng, radius, city.id]);
  return { ok: true, message: `Salvato: ${city.name}.` };
}

/** Uploads ratings.csv or watchlist.csv: the type is read from the file's columns. */
export async function uploadCsv(_prev: SaveState, form: FormData): Promise<SaveState> {
  const u = await currentUser();
  const file = form.get("csv");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Scegli un file." };
  if (file.size > 2_000_000) return { ok: false, message: "File troppo grande (max 2 MB)." };
  try {
    const text = await file.text();
    const kind = csvKind(text);
    const entries = parseCsv(text, kind);
    if (!entries.length) return { ok: false, message: "Il file non contiene film. Serve ratings.csv o watchlist.csv dall'export di Letterboxd." };
    await saveEntries(u.id, entries, [kind]);
    revalidatePath("/account");
    return {
      ok: true,
      message: kind === "seen" ? `${entries.length} voti importati da ${file.name}.` : `${entries.length} film della watchlist importati da ${file.name}.`,
    };
  } catch {
    return { ok: false, message: "Non riesco a leggere il file. Serve ratings.csv o watchlist.csv dall'export di Letterboxd." };
  }
}

export async function deleteAccount(): Promise<void> {
  const u = await currentUser();
  await q("DELETE FROM users WHERE id = $1", [u.id]);
}
