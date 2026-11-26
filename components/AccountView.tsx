"use client";
import Link from "next/link";
import { Check, ChevronLeft, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { connectLetterboxd, savePlace, uploadCsv, type SaveState } from "@/lib/account";
import { QUARTIERI } from "@/lib/view";

export interface AccountData {
  email: string;
  letterboxd: string | null;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  watchlist: number;
  rated: number;
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
      <h1 className="disp">{mode === "reset" ? "Nuova password" : "Account Bijoux"}</h1>
      <p className="lede">
        {mode === "reset"
          ? "Ti mandiamo un codice via mail, poi scegli la password nuova."
          : "Un account solo per Bijoux, con la tua email: non è il tuo account Letterboxd. Dopo, nelle impostazioni, colleghi Letterboxd scrivendo solo il nome del tuo profilo."}
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
            {mode !== "signin" && <p className="hint">Una password nuova per Bijoux, non quella di Letterboxd. Almeno 8 caratteri.</p>}
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
  const [lbState, connect, connecting] = useActionState(connectLetterboxd, idle);
  const [csvState, upload, uploading] = useActionState(uploadCsv, idle);
  const csvForm = useRef<HTMLFormElement>(null);

  const quartiere = QUARTIERI.find((q) => data.lat != null && Math.abs(q.lat - data.lat) < 1e-4 && Math.abs(q.lng - data.lng!) < 1e-4);
  const [place, setPlace] = useState({
    lat: data.lat,
    lng: data.lng,
    label: quartiere?.label ?? (data.lat != null ? "La tua posizione" : ""),
    radius: data.radiusKm,
  });
  const router = useRouter();
  const [placeMsg, setPlaceMsg] = useState<SaveState>(idle);
  const [placePending, setPlacePending] = useState(false);
  const storePlace = async (next: typeof place) => {
    setPlace(next);
    if (next.lat == null || next.lng == null) return;
    setPlacePending(true);
    try {
      const r = await savePlace(next.lat, next.lng, next.radius);
      setPlaceMsg(r);
      if (r.ok) router.refresh(); // updates the checklist at the top
    } catch {
      setPlaceMsg({ ok: false, message: "Non sono riuscito a salvare: riprova." });
    } finally {
      setPlacePending(false);
    }
  };

  const steps = [
    {
      done: !!data.letterboxd && data.watchlist > 0,
      title: "Letterboxd collegato",
      detail: data.letterboxd ? `${data.letterboxd}, ${data.watchlist} film in watchlist` : "Non ancora",
    },
    {
      done: data.lat != null,
      title: "Dove sei",
      detail: data.lat != null ? `${place.label || "Posizione salvata"}, entro ${data.radiusKm} km` : "Non ancora",
    },
    {
      done: data.rated > 0,
      title: "Voti caricati",
      detail: data.rated > 0 ? `${data.rated} voti` : "Consigliato: servono per avvisarti dei film che hai amato",
    },
  ];
  const ready = steps[0].done && steps[1].done;

  return (
    <main className="auth">
      <Back />
      <h1 className="disp">Impostazioni</h1>
      <p className="lede">{ready ? `Pronto. Ti scriviamo a ${data.email} quando stai per perderti un film.` : `Due passi e ti scriviamo a ${data.email} quando stai per perderti un film.`}</p>

      <ul className="steps" aria-label="Stato">
        {steps.map((s) => (
          <li key={s.title} data-done={s.done}>
            {s.done ? <Check size={18} strokeWidth={2} aria-label="fatto" /> : <Circle size={18} strokeWidth={1.5} aria-label="da fare" />}
            <span>
              <b>{s.title}</b>
              <small>{s.detail}</small>
            </span>
          </li>
        ))}
      </ul>

      <section className="fields" aria-labelledby="lb-h">
        <h2 id="lb-h" className="disp">
          Letterboxd
        </h2>
        <form action={connect} className="inline">
          <label htmlFor="lb">Nome del tuo profilo Letterboxd</label>
          <p className="hint">
            Non entri con Letterboxd: ci basta il nome del profilo pubblico, quello nell&apos;indirizzo letterboxd.com/<b>nome</b>. Nessuna password.
          </p>
          <div className="row-input">
            <input id="lb" name="letterboxd" defaultValue={data.letterboxd ?? ""} placeholder="es. albertodm" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            <button className="btn" type="submit" disabled={connecting}>
              {connecting ? "Leggo…" : data.letterboxd ? "Aggiorna" : "Collega"}
            </button>
          </div>
          {lbState.message && (
            <p className={lbState.ok ? "ok" : "err"} role="status">
              {lbState.message}
            </p>
          )}
        </form>
      </section>

      <section className="fields" aria-labelledby="pos-h">
        <h2 id="pos-h" className="disp">
          Dove sei
        </h2>
        <p className="hint">Ti avvisiamo solo per le sale entro questa distanza. Si salva da solo.</p>
        <label htmlFor="q">Quartiere</label>
        <select
          id="q"
          value={QUARTIERI.some((q) => q.label === place.label) ? place.label : ""}
          onChange={(e) => {
            const q = QUARTIERI.find((x) => x.label === e.target.value);
            if (q) storePlace({ ...place, lat: q.lat, lng: q.lng, label: q.label });
          }}
        >
          <option value="" disabled>
            {place.lat != null ? "La tua posizione" : "Scegli un quartiere"}
          </option>
          {QUARTIERI.map((q) => (
            <option key={q.label}>{q.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="textbtn"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (p) => storePlace({ ...place, lat: p.coords.latitude, lng: p.coords.longitude, label: "La tua posizione" }),
              () => setPlaceMsg({ ok: false, message: "Posizione non disponibile: scegli un quartiere." }),
            )
          }
        >
          Usa la mia posizione
        </button>
        <label htmlFor="r">Distanza massima</label>
        <select id="r" value={place.radius} onChange={(e) => storePlace({ ...place, radius: Number(e.target.value) })}>
          {[2, 3, 5, 8, 12, 20].map((k) => (
            <option key={k} value={k}>
              Entro {k} km
            </option>
          ))}
        </select>
        {(placePending || placeMsg.message) && (
          <p className={placeMsg.ok ? "ok" : "err"} role="status">
            {placePending ? "Salvo…" : placeMsg.message}
          </p>
        )}
      </section>

      <section className="fields" aria-labelledby="csv-h">
        <h2 id="csv-h" className="disp">
          Voti
        </h2>
        <p className="hint">Letterboxd non mostra i voti a chi non è nel tuo account, quindi servono dal tuo export:</p>
        <ol className="howto">
          <li>
            Apri{" "}
            <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noopener">
              letterboxd.com/settings/data
            </a>{" "}
            e premi Export your data.
          </li>
          <li>Apri lo zip che scarica.</li>
          <li>Qui sotto scegli il file ratings.csv: si carica da solo.</li>
        </ol>
        <form action={upload} ref={csvForm}>
          <label className="btn ghost filebtn" htmlFor="csv">
            {uploading ? "Carico…" : data.rated > 0 ? "Carica di nuovo ratings.csv" : "Scegli ratings.csv"}
          </label>
          <input id="csv" name="csv" type="file" accept=".csv,text/csv" className="sr" onChange={() => csvForm.current?.requestSubmit()} />
          {csvState.message && (
            <p className={csvState.ok ? "ok" : "err"} role="status">
              {csvState.message}
            </p>
          )}
        </form>
      </section>

      <div className="done-row">
        <Link href="/" className="btn">
          Torna alle locandine
        </Link>
        <button
          type="button"
          className="textbtn signout"
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/");
          }}
        >
          Esci dall&apos;account
        </button>
      </div>
    </main>
  );
}
