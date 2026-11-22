"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { saveSettings, uploadCsv, type SaveState } from "@/lib/account";
import { QUARTIERI } from "@/lib/view";
import { Logo } from "./Logo";

export interface AccountData {
  email: string;
  letterboxd: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  entries: number;
  syncedAt: string | null;
}

const idle: SaveState = { ok: true, message: "" };

export function SignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="page tc">
      <Link className="lab back" href="/">
        ‹ la bacheca
      </Link>
      <div style={{ marginTop: 18 }}><Logo /></div>
      <h1 className="t disp" style={{ marginTop: 16 }}>
        Non perderti niente
      </h1>
      <p className="m" style={{ maxWidth: 360, margin: "10px auto 0" }}>
        Collega Letterboxd: ti scriviamo solo quando un film della tua lista sta per lasciare le sale.
      </p>
      <div className="acts" style={{ maxWidth: 320, margin: "26px auto 0", display: "flex" }}>
        <a
          className="pill p"
          href="#"
          aria-disabled={pending}
          onClick={async (e) => {
            e.preventDefault();
            setPending(true);
            const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/account" });
            if (error) {
              setError(error.message ?? "Accesso non riuscito");
              setPending(false);
            }
          }}
        >
          {pending ? "Un attimo…" : "Entra con Google"}
        </a>
      </div>
      {error && (
        <p className="lab" role="alert" style={{ marginTop: 14, color: "var(--orange)" }}>
          {error}
        </p>
      )}
    </main>
  );
}

export function AccountView({ data }: { data: AccountData }) {
  const [state, save, saving] = useActionState(saveSettings, idle);
  const [csvState, upload, uploading] = useActionState(uploadCsv, idle);
  const near = QUARTIERI.find((q) => data.lat != null && Math.abs(q.lat - data.lat) < 1e-4 && Math.abs(q.lng - data.lng!) < 1e-4);
  const [pos, setPos] = useState<{ lat: number | null; lng: number | null; label: string }>({
    lat: data.lat,
    lng: data.lng,
    label: near?.label ?? (data.lat != null ? "posizione salvata" : ""),
  });

  return (
    <main className="page">
      <div className="tc">
        <Link className="lab back" href="/">
          ‹ la bacheca
        </Link>
        <h1 className="t disp" style={{ marginTop: 10 }}>
          Le tue impostazioni
        </h1>
        <p className="m">{data.email}</p>
      </div>

      <form action={save} className="tb" style={{ maxWidth: 440, margin: "24px auto 0" }}>
        <div className="cn">
          <b>Letterboxd</b>
        </div>
        <label className="lab" htmlFor="lb" style={{ display: "block", marginTop: 10 }}>
          Username pubblico
        </label>
        <div className="locform" style={{ margin: "6px 0 0", maxWidth: "none", justifyContent: "flex-start" }}>
          <input id="lb" name="letterboxd" defaultValue={data.letterboxd ?? ""} placeholder="es. ilmionome" autoComplete="off" />
        </div>
        <p style={{ fontSize: 14, marginTop: 6 }}>
          {data.entries > 0 ? `${data.entries} film letti` : "Nessun film letto finora"}
          {data.syncedAt ? ` · ultima lettura ${new Date(data.syncedAt).toLocaleDateString("it-IT")}` : ""}
        </p>

        <div className="cn" style={{ marginTop: 18 }}>
          <b>Dove sei</b>
        </div>
        <div className="locform" style={{ margin: "10px 0 0", maxWidth: "none", justifyContent: "flex-start" }}>
          <label className="sr" htmlFor="q">
            Quartiere
          </label>
          <select
            id="q"
            value={near?.label ?? pos.label}
            onChange={(e) => {
              const q = QUARTIERI.find((x) => x.label === e.target.value);
              if (q) setPos({ lat: q.lat, lng: q.lng, label: q.label });
            }}
          >
            <option value="" disabled>
              Scegli un quartiere
            </option>
            {pos.label && !QUARTIERI.some((q) => q.label === pos.label) && <option>{pos.label}</option>}
            {QUARTIERI.map((q) => (
              <option key={q.label}>{q.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, label: "posizione attuale" }))
            }
          >
            Usa la posizione
          </button>
          <label className="sr" htmlFor="r">
            Raggio
          </label>
          <select id="r" name="radius" defaultValue={data.radiusKm}>
            {[2, 3, 5, 8, 12, 20].map((k) => (
              <option key={k} value={k}>
                entro {k} km
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="lat" value={pos.lat ?? ""} />
        <input type="hidden" name="lng" value={pos.lng ?? ""} />

        <div className="acts">
          <button className="p" type="submit" disabled={saving} style={{ flex: 1, minHeight: 44, borderRadius: 999, background: "var(--orange)", color: "var(--on-orange)", font: "500 11px var(--sans)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {saving ? "Salvo…" : "Salva"}
          </button>
        </div>
        {state.message && (
          <p role="status" style={{ marginTop: 10, fontSize: 14, color: state.ok ? "inherit" : "var(--orange)" }}>
            {state.message}
          </p>
        )}
      </form>

      <form action={upload} className="tb" style={{ maxWidth: 440, margin: "36px auto 0" }}>
        <div className="cn">
          <b>Oppure carica l&apos;export</b>
        </div>
        <p style={{ fontSize: 14, marginTop: 8 }}>
          Da Letterboxd: Settings → Data → Export. Carica <i>watchlist.csv</i> o <i>ratings.csv</i>.
        </p>
        <div className="locform" style={{ margin: "10px 0 0", maxWidth: "none", justifyContent: "flex-start" }}>
          <label className="sr" htmlFor="csv">
            File CSV
          </label>
          <input id="csv" name="csv" type="file" accept=".csv,text/csv" />
          <label className="sr" htmlFor="kind">
            Tipo
          </label>
          <select id="kind" name="kind" defaultValue="watchlist">
            <option value="watchlist">watchlist.csv</option>
            <option value="seen">ratings.csv</option>
          </select>
          <button type="submit" disabled={uploading}>
            {uploading ? "Carico…" : "Carica"}
          </button>
        </div>
        {csvState.message && (
          <p role="status" style={{ marginTop: 10, fontSize: 14, color: csvState.ok ? "inherit" : "var(--orange)" }}>
            {csvState.message}
          </p>
        )}
      </form>

      <p className="tc" style={{ marginTop: 40 }}>
        <button
          type="button"
          className="lab"
          style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
          onClick={async () => {
            await authClient.signOut();
            window.location.href = "/";
          }}
        >
          Esci
        </button>
      </p>
    </main>
  );
}
