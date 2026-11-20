"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, BoardFilm, BoardScreening } from "@/lib/board";
import {
  QUARTIERI,
  cinemasInRadius,
  dayKey,
  dayNum,
  fmtKm,
  hhmm,
  rankForYou,
  ribbon,
  tonight,
  weekday,
} from "@/lib/view";
import { Monogram } from "./Monogram";
import { usePlace } from "./usePlace";

type Tab = "perte" | "stasera";

function Poster({ f, eager }: { f: BoardFilm; eager?: boolean }) {
  return f.poster ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote posters from cinemas/TMDB, no optimizer on Workers free
    <img src={f.poster} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />
  ) : (
    <span className="noposter" aria-hidden="true">
      {f.title}
    </span>
  );
}

export function BoardView({ board }: { board: Board }) {
  const { place, setPlace, locate, asking, denied } = usePlace();
  const [tab, setTab] = useState<Tab>("perte");
  const [idx, setIdx] = useState(2);
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => new Date(board.generatedAt));
  useEffect(() => setNow(new Date()), []);

  const halls = useMemo(() => cinemasInRadius(board.cinemas, place), [board.cinemas, place]);
  const near = useMemo(() => new Set<string>(halls.map((c) => c.id)), [halls]);
  const cinemaName = (id: string) => board.cinemas.find((c) => c.id === id)?.name ?? id;

  const list = useMemo(() => {
    const ranked = (tab === "perte" ? rankForYou(board.films, near, now) : tonight(board.films, near, now)).slice(0, 24);
    // symmetric composition (refs/bijoux.html): best film in the middle, runners-up on both sides
    return ranked.length >= 3 ? [ranked[2], ranked[1], ranked[0], ...ranked.slice(3)] : ranked;
  }, [tab, board.films, near, now]);
  const startIdx = list.length >= 3 ? 2 : 0;
  useEffect(() => setIdx(startIdx), [startIdx, tab, place.lat, place.lng, place.radiusKm]);
  const cur = list[Math.min(idx, Math.max(0, list.length - 1))];

  const move = (d: number) => setIdx((i) => Math.max(0, Math.min(list.length - 1, i + d)));
  const drag = useRef<{ x: number; moved: boolean } | null>(null);

  const days = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 7; i++) keys.push(dayKey(new Date(now.getTime() + i * 86_400_000)));
    return keys;
  }, [now]);
  const [day, setDay] = useState<string | null>(null);
  const selDay = day ?? days[0];

  const byHall = useMemo(() => {
    const rows: { cinemaId: string; f: BoardFilm; s: BoardScreening }[] = [];
    for (const f of board.films)
      for (const s of f.screenings)
        if (near.has(s.cinemaId) && dayKey(s.startsAt) === selDay && new Date(s.startsAt) > now) rows.push({ cinemaId: s.cinemaId, f, s });
    rows.sort((a, b) => a.s.startsAt.localeCompare(b.s.startsAt));
    return halls.map((h) => ({ h, rows: rows.filter((r) => r.cinemaId === h.id) })).filter((x) => x.rows.length);
  }, [board.films, near, selDay, halls, now]);

  const rib = cur ? ribbon(cur.rows, now) : null;
  const first = cur?.rows[0];

  return (
    <main className="page">
      <header className="hd">
        <h1 className="sr">Bijoux, cinema d&apos;essai a Milano</h1>
        <Monogram />
        <div className="lab loc">
          <span>cinema d&apos;essai · entro {place.radiusKm} km</span>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing} aria-controls="locform">
            {asking ? "cerco…" : place.precise ? "da qui" : `da ${place.label}`}
          </button>
        </div>
        {editing && (
          <form
            id="locform"
            className="locform"
            onSubmit={(e) => {
              e.preventDefault();
              setEditing(false);
            }}
          >
            <label className="sr" htmlFor="quartiere">
              Quartiere
            </label>
            <select
              id="quartiere"
              value={place.precise ? "" : place.label}
              onChange={(e) => {
                const q = QUARTIERI.find((x) => x.label === e.target.value);
                if (q) setPlace({ ...q, radiusKm: place.radiusKm, precise: false });
              }}
            >
              <option value="" disabled>
                Scegli un quartiere
              </option>
              {QUARTIERI.map((q) => (
                <option key={q.label}>{q.label}</option>
              ))}
            </select>
            <label className="sr" htmlFor="raggio">
              Raggio in km
            </label>
            <select id="raggio" value={place.radiusKm} onChange={(e) => setPlace({ ...place, radiusKm: Number(e.target.value) })}>
              {[2, 3, 5, 8, 12, 20].map((k) => (
                <option key={k} value={k}>
                  entro {k} km
                </option>
              ))}
            </select>
            <button type="button" onClick={() => locate(place.radiusKm)}>
              Usa la mia posizione
            </button>
            {denied && <p className="lab">posizione non disponibile: scegli un quartiere</p>}
          </form>
        )}
        <div className="tabs lab" role="group" aria-label="Selezione">
          <button type="button" aria-pressed={tab === "perte"} onClick={() => setTab("perte")}>
            Per te
          </button>
          <button type="button" aria-pressed={tab === "stasera"} onClick={() => setTab("stasera")}>
            Stasera
          </button>
          <a className="lab" href="#per-sala" style={{ padding: "6px 0 5px", textDecoration: "none" }}>
            Per sala
          </a>
        </div>
        {board.freshness.banner && (
          <p className="banner lab" role="status">
            {board.freshness.banner}
          </p>
        )}
      </header>

      {list.length === 0 ? (
        <p className="empty">
          {halls.length === 0 ? "Nessuna sala d'essai in questo raggio: allargalo." : "Niente in programma qui, per ora."}
        </p>
      ) : (
        <section aria-roledescription="carosello" aria-label={tab === "perte" ? "Per te" : "Stasera"}>
          <div
            className="flow"
            onPointerDown={(e) => (drag.current = { x: e.clientX, moved: false })}
            onPointerMove={(e) => {
              if (drag.current && Math.abs(e.clientX - drag.current.x) > 40) {
                move(e.clientX < drag.current.x ? 1 : -1);
                drag.current = { x: e.clientX, moved: true };
              }
            }}
            onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
            onPointerCancel={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(1);
              if (e.key === "ArrowLeft") move(-1);
            }}
          >
            {list.map(({ f }, i) => {
              const d = i - idx;
              const pos = Math.abs(d) <= 2 ? String(d) : "hidden";
              const common = { className: "cov", "data-pos": pos, "data-testid": d === 0 ? "cover-active" : undefined } as const;
              return d === 0 ? (
                <Link
                  key={f.id}
                  {...common}
                  href={`/film/${f.id}`}
                  aria-label={`Apri la scheda di ${f.title}`}
                  onClick={(e) => drag.current?.moved && e.preventDefault()}
                >
                  <Poster f={f} eager />
                </Link>
              ) : (
                <button
                  key={f.id}
                  type="button"
                  {...common}
                  tabIndex={pos === "hidden" ? -1 : 0}
                  aria-hidden={pos === "hidden"}
                  aria-label={`Mostra ${f.title}`}
                  onClick={() => !drag.current?.moved && setIdx(i)}
                >
                  <Poster f={f} eager={Math.abs(d) <= 2} />
                </button>
              );
            })}
          </div>
          <div className="flownav">
            <button type="button" onClick={() => move(-1)} disabled={idx === 0} aria-label="Film precedente">
              ‹
            </button>
            <span className="lab" style={{ alignSelf: "center" }} aria-live="polite">
              {idx + 1} / {list.length}
            </span>
            <button type="button" onClick={() => move(1)} disabled={idx >= list.length - 1} aria-label="Film successivo">
              ›
            </button>
          </div>
          {cur && (
            <div className="tc">
              <h2 className="t disp">
                <Link href={`/film/${cur.f.id}`} style={{ textDecoration: "none" }}>
                  {cur.f.title}
                </Link>
              </h2>
              {(cur.f.director || cur.f.year) && (
                <p className="m">
                  {cur.f.director ? `di ${cur.f.director}` : ""}
                  {cur.f.director && cur.f.year ? ", " : ""}
                  {cur.f.year ?? ""}
                </p>
              )}
              {rib && <div className="rib">{rib}</div>}
            </div>
          )}
          {first && (
            <Link className="next" href={`/film/${cur.f.id}`}>
              <span className="lab">Prossimo</span>
              <span>
                {cinemaName(first.cinemaId).replace(/^Cin(ema|eteca) /, "")} · {weekday(first.startsAt)} {hhmm(first.startsAt)}
              </span>
            </Link>
          )}
        </section>
      )}

      <section className="sec" id="per-sala" aria-labelledby="per-sala-h">
        <h2 id="per-sala-h" className="lab">
          Per sala
        </h2>
        <div className="days" role="group" aria-label="Giorno">
          {days.map((k) => {
            const d = new Date(`${k}T12:00:00Z`);
            return (
              <button key={k} type="button" aria-pressed={k === selDay} onClick={() => setDay(k)}>
                {k === days[0] ? "oggi" : weekday(d)}
                <b>{dayNum(d)}</b>
              </button>
            );
          })}
        </div>
        {byHall.length === 0 ? (
          <p className="empty">Nessuna proiezione in questo giorno nel raggio.</p>
        ) : (
          <div className="halls">
            {byHall.map(({ h, rows }) => (
              <div key={h.id} data-testid="hall" data-cinema={h.id}>
                <div className="cn">
                  <b>{h.name}</b>
                  <span className="lab">{fmtKm(h.km)}</span>
                </div>
                {rows.map(({ f, s }) => (
                  <Link key={`${f.id}-${s.startsAt}`} className="sl" href={`/film/${f.id}`}>
                    <span className="tm">{hhmm(s.startsAt)}</span>
                    <span className="ttl">
                      {f.title}
                      {s.vo && <i>V.O.</i>}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="foot lab">
        <p>{board.freshness.label}</p>
        <p style={{ marginTop: 8 }}>
          <Link href="/account">Collega Letterboxd</Link>
        </p>
      </footer>
    </main>
  );
}
