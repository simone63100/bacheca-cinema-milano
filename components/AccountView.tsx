"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { saveSettings, uploadCsv, type SaveState } from "@/lib/account";
import { QUARTIERI } from "@/lib/view";

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

function Back() {
  return (
    <Link href="/" className="back">
      <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" /> Locandine
    </Link>
  );
}

type Mode = "signin" | "signup" | "reset";

/** Better Auth error codes → Italian, the rest falls back to the server message. */
const BY_MESSAGE: [RegExp, string][] = [
  [/invalid email or password|invalid password|user not found/i, "INVALID_EMAIL_OR_PASSWORD"],
  [/already exists/i, "USER_ALREADY_EXISTS"],
  [/password (is )?too short/i, "PASSWORD_TOO_SHORT"],
  [/invalid otp|otp expired|invalid code/i, "INVALID_OTP"],
];

function explain(e: { code?: string; message?: string; status?: number } | null | undefined): string {
  // thrown AuthApiError carries its own code; the server's code survives only in the message
  const code = BY_MESSAGE.find(([re]) => re.test(e?.message ?? ""))?.[1] ?? e?.code;
  if (!code && (e?.status === 401 || e?.status === 403)) return "Email o password non corretti.";
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return "Email o password non corretti.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Esiste già un account con questa email: entra invece di crearne uno.";
    case "PASSWORD_TOO_SHORT":
      return "La password deve avere almeno 8 caratteri.";
    case "INVALID_OTP":
    case "OTP_EXPIRED":
      return "Codice non valido o scaduto.";
    default:
      return e?.message || "Qualcosa non ha funzionato, riprova.";
  }
}

// emailOtp is a managed plugin: typed loosely so a missing method fails at runtime with a message
type OtpClient = {
  emailOtp?: {
    sendVerificationOtp?: (a: { email: string; type: "forget-password" }) => Promise<{ error?: { code?: string; message?: string } | null }>;
    resetPassword?: (a: { email: string; otp: string; password: string }) => Promise<{ error?: { code?: string; message?: string } | null }>;
  };
};

export function SignIn() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    setCodeSent(false);
  };

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) return setError(explain(error));
        window.location.assign("/account");
      } else if (mode === "signup") {
        const { error } = await authClient.signUp.email({ email, password, name: email.split("@")[0] });
        if (error) return setError(explain(error));
        window.location.assign("/account");
      } else {
        const otpApi = (authClient as unknown as OtpClient).emailOtp;
        if (!codeSent) {
          const r = await otpApi?.sendVerificationOtp?.({ email, type: "forget-password" });
          if (!r || r.error) return setError(explain(r?.error));
          setCodeSent(true);
          setNotice(`Ti abbiamo mandato un codice a ${email}.`);
        } else {
          const r = await otpApi?.resetPassword?.({ email, otp, password });
          if (!r || r.error) return setError(explain(r?.error));
          switchTo("signin");
          setNotice("Password cambiata: ora puoi entrare.");
        }
      }
    } catch (err) {
      // the Neon client throws AuthApiError on 4xx instead of returning { error }
      setError(explain(err as { code?: string; message?: string; status?: number }));
    } finally {
      setPending(false);
    }
  };

  const google = async () => {
    setPending(true);
    try {
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/account" });
      if (error) throw error;
    } catch (err) {
      setError(explain(err as { code?: string; message?: string; status?: number }));
      setPending(false);
    }
  };

  const cta =
    mode === "signin" ? "Entra" : mode === "signup" ? "Crea account" : codeSent ? "Imposta la nuova password" : "Mandami il codice";

  return (
    <main className="auth">
      <Back />
      <h1 className="disp">{mode === "reset" ? "Nuova password" : "Il tuo Bijoux"}</h1>
      <p className="lede">
        {mode === "reset"
          ? "Ti mandiamo un codice via mail, poi scegli la password nuova."
          : "Serve solo per collegare Letterboxd e ricevere una mail quando un film della tua lista sta per lasciare le sale."}
      </p>

      {mode !== "reset" && (
        <div className="views auth-switch" role="group" aria-label="Accesso">
          <button type="button" aria-pressed={mode === "signin"} onClick={() => switchTo("signin")}>
            Entra
          </button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => switchTo("signup")}>
            Crea account
          </button>
        </div>
      )}

      <form className="fields" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={mode === "reset" && codeSent} />

        {mode === "reset" && codeSent && (
          <>
            <label htmlFor="otp">Codice</label>
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(e) => setOtp(e.target.value.trim())} />
          </>
        )}

        {(mode !== "reset" || codeSent) && (
          <>
            <label htmlFor="password">{mode === "reset" ? "Nuova password" : "Password"}</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode !== "signin" && <p className="hint">Almeno 8 caratteri.</p>}
          </>
        )}

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="hint" role="status">
            {notice}
          </p>
        )}

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Un attimo…" : cta}
        </button>
      </form>

      {mode === "signin" && (
        <button type="button" className="textbtn" onClick={() => switchTo("reset")}>
          Password dimenticata?
        </button>
      )}
      {mode === "reset" && (
        <button type="button" className="textbtn" onClick={() => switchTo("signin")}>
          Torna all&apos;accesso
        </button>
      )}

      {mode !== "reset" && (
        <>
          <p className="or">oppure</p>
          <button type="button" className="btn ghost" onClick={google} disabled={pending}>
            Continua con Google
          </button>
        </>
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
    label: near?.label ?? (data.lat != null ? "Posizione salvata" : ""),
  });

  return (
    <main className="auth">
      <Back />
      <h1 className="disp">Impostazioni</h1>
      <p className="lede">{data.email}</p>

      <form action={save} className="fields">
        <h2 className="disp">Letterboxd</h2>
        <label htmlFor="lb">Username pubblico</label>
        <input id="lb" name="letterboxd" defaultValue={data.letterboxd ?? ""} placeholder="ilmionome" autoComplete="off" autoCapitalize="none" />
        <p className="hint">
          {data.entries > 0 ? `${data.entries} film letti` : "Nessun film letto finora"}
          {data.syncedAt ? `, ultima lettura il ${new Date(data.syncedAt).toLocaleDateString("it-IT")}` : ""}. La watchlist si aggiorna una volta al giorno.
        </p>

        <h2 className="disp">Dove sei</h2>
        <label htmlFor="q">Da dove parti</label>
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
          className="textbtn"
          onClick={() => navigator.geolocation?.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Posizione attuale" }))}
        >
          Usa la mia posizione
        </button>
        <label htmlFor="r">Quanto lontano</label>
        <select id="r" name="radius" defaultValue={data.radiusKm}>
          {[2, 3, 5, 8, 12, 20].map((k) => (
            <option key={k} value={k}>
              Entro {k} km
            </option>
          ))}
        </select>
        <input type="hidden" name="lat" value={pos.lat ?? ""} />
        <input type="hidden" name="lng" value={pos.lng ?? ""} />

        {state.message && (
          <p className={state.ok ? "hint" : "err"} role="status">
            {state.message}
          </p>
        )}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvo…" : "Salva"}
        </button>
      </form>

      <form action={upload} className="fields">
        <h2 className="disp">Carica l&apos;export</h2>
        <p className="hint">
          I voti non si leggono dal profilo pubblico: caricali da Letterboxd, Impostazioni, Data, Export. Va bene anche la watchlist.
        </p>
        <label htmlFor="kind">File</label>
        <select id="kind" name="kind" defaultValue="seen">
          <option value="seen">ratings.csv (voti)</option>
          <option value="watchlist">watchlist.csv</option>
        </select>
        <input id="csv" name="csv" type="file" accept=".csv,text/csv" aria-label="File CSV" />
        {csvState.message && (
          <p className={csvState.ok ? "hint" : "err"} role="status">
            {csvState.message}
          </p>
        )}
        <button className="btn ghost" type="submit" disabled={uploading}>
          {uploading ? "Carico…" : "Carica"}
        </button>
      </form>

      <button
        type="button"
        className="textbtn signout"
        onClick={async () => {
          await authClient.signOut();
          window.location.assign("/");
        }}
      >
        Esci
      </button>
    </main>
  );
}
