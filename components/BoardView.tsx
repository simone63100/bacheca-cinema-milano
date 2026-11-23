"use client";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board, BoardFilm, BoardScreening } from "@/lib/board";
import { distanceKm } from "@/lib/geo";
import {
  QUARTIERI,
  calendarUrl,
  cinemasInRadius,
  dayKey,
  dayNum,
  fmtKm,
  hhmm,
  letterboxdUrl,
  rankForYou,
  ribbon,
  tonight,
  trailerUrl,
  weekday,
  when,
} from "@/lib/view";
import { usePlace } from "./usePlace";

type Tab = "perte" | "stasera" | "sala";
interface Item {
  f: BoardFilm;
  rows: BoardScreening[];
}

const ORANGE = "#f08a1f";
const TABS: [Tab, string][] = [
  ["perte", "Per te"],
  ["stasera", "Stasera"],
  ["sala", "Per sala"],
];

const longDay = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Poster({ f, eager }: { f: BoardFilm; eager?: boolean }) {
  return f.poster ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote posters (TMDB / cinemas), no image optimizer on Workers free
    <img src={f.poster} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" draggable={false} />
  ) : (
    <span className="noposter" aria-hidden="true">
      {f.title}
    </span>
  );
}

function filmIdFromUrl(): number | null {
  const v = new URLSearchParams(window.location.search).get("film");
  const n = v ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function BoardView({ board }: { board: Board }) {
  const { place, setPlace, locate, asking, denied } = usePlace();
  const [tab, setTab] = useState<Tab>("perte");
  const [idx, setIdx] = useState(2);
  const [openId, setOpenId] = useState<number | null>(null);
  const [sel, setSel] = useState(0);
  const [settings, setSettings] = useState(false);
  const [now, setNow] = useState(() => new Date(board.generatedAt));
  const pushed = useRef(false);

  useEffect(() => {
    setNow(new Date());
    document.body.classList.add("screen");
    return () => document.body.classList.remove("screen");
  }, []);

  const cinemaName = useCallback((id: string) => board.cinemas.find((c) => c.id === id)?.name ?? id, [board.cinemas]);
  const halls = useMemo(() => cinemasInRadius(board.cinemas, place), [board.cinemas, place]);
  const near = useMemo(() => new Set<string>(halls.map((c) => c.id)), [halls]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayKey(new Date(now.getTime() + i * 86_400_000))), [now]);
  const [hall, setHall] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const selHall = hall && near.has(hall) ? hall : (halls[0]?.id ?? null);
  const selDay = day ?? days[0];

  const list: Item[] = useMemo(() => {
    if (tab === "sala") {
      return board.films
        .map((f) => ({ f, rows: f.screenings.filter((s) => s.cinemaId === selHall && dayKey(s.startsAt) === selDay && new Date(s.startsAt) > now) }))
        .filter((x) => x.rows.length)
        .sort((a, b) => a.rows[0].startsAt.localeCompare(b.rows[0].startsAt));
    }
    const ranked = (tab === "perte" ? rankForYou(board.films, near, now) : tonight(board.films, near, now)).slice(0, 24);
    // symmetric composition: the best film in the middle, the runners-up on both sides
    return ranked.length >= 3 ? [ranked[2], ranked[1], ranked[0], ...ranked.slice(3)] : ranked;
  }, [tab, board.films, near, now, selHall, selDay]);

  const startIdx = tab !== "sala" && list.length >= 3 ? 2 : 0;
  useEffect(() => setIdx(startIdx), [startIdx, tab, place.lat, place.lng, place.radiusKm, selHall, selDay]);
  const safeIdx = Math.min(idx, Math.max(0, list.length - 1));
  const cur = list[safeIdx];
  const move = useCallback((d: number) => setIdx((i) => Math.max(0, Math.min(list.length - 1, i + d))), [list.length]);

  // ---- panel: open/close mirrored in the URL (?film=id), so mails and shared links land on it
  const openFilm = useMemo(() => (openId == null ? null : (board.films.find((f) => f.id === openId) ?? null)), [openId, board.films]);
  const open = useCallback((f: BoardFilm) => {
    setOpenId(f.id);
    setSel(0);
    if (filmIdFromUrl() !== f.id) {
      window.history.pushState({ film: f.id }, "", `/?film=${f.id}`);
      pushed.current = true;
    }
  }, []);
  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", "/");
      setOpenId(null);
    }
  }, []);
  useEffect(() => {
    const sync = () => setOpenId(filmIdFromUrl());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (openId == null) return;
    const i = list.findIndex((x) => x.f.id === openId);
    if (i >= 0) setIdx(i);
  }, [openId, list]);

  const panelRows = useMemo(() => {
    if (!openFilm) return [];
    return openFilm.screenings
      .filter((s) => new Date(s.startsAt) > now)
      .map((s) => {
        const c = board.cinemas.find((x) => x.id === s.cinemaId)!;
        return { s, c, km: distanceKm(place, c) };
      })
      .sort(
        (a, b) =>
          Number(b.c.id === (tab === "sala" ? selHall : "")) - Number(a.c.id === (tab === "sala" ? selHall : "")) ||
          Number(a.km > place.radiusKm) - Number(b.km > place.radiusKm) ||
          a.s.startsAt.localeCompare(b.s.startsAt),
      );
  }, [openFilm, board.cinemas, place, now, tab, selHall]);

  // ---- keyboard: arrows, Enter, Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (settings) {
        if (e.key === "Escape") setSettings(false);
        return;
      }
      if (openFilm) {
        if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault();
          close();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          setSel((s) => Math.min(panelRows.length - 1, s + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSel((s) => Math.max(0, s - 1));
        }
        return;
      }
      if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "Enter" && cur && document.activeElement === document.body) open(cur.f);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFilm, panelRows.length, close, move, open, cur, settings]);

  useEffect(() => {
    document.querySelector(`[data-row="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  // ---- swipe and wheel on the flow, swipe down on the panel header
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const wheel = useRef({ acc: 0, t: 0 });
  const onWheel = (e: React.WheelEvent) => {
    if (openFilm) return;
    const w = wheel.current;
    w.acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const t = performance.now();
    if (Math.abs(w.acc) > 40 && t - w.t > 180) {
      move(w.acc > 0 ? 1 : -1);
      w.acc = 0;
      w.t = t;
    }
  };

  const urgency = cur ? ribbon(cur.rows, now) : null;
  const first = cur?.rows[0];
  const accent = (openFilm ?? cur?.f)?.accent ?? ORANGE;
  const tags = (f: BoardFilm) =>
    [
      f.screenings.some((s) => s.vo) && "v.o.",
      (f.tags.includes("restauro") || f.screenings.some((s) => s.special)) && (f.tags.includes("classico") ? "restaurato" : "evento"),
      f.tags.includes("prima-visione") && "prima visione",
    ].filter(Boolean) as string[];

  return (
    <div className="ipod" style={{ ["--accent" as string]: accent }}>
      <h1 className="sr">Bijoux, cinema d&apos;essai a Milano</h1>
      {board.freshness.banner && (
        <p className="stale" role="status">
          {board.freshness.banner}
        </p>
      )}

      <main className="stage" data-open={openFilm ? "true" : "false"}>
        <div className="glow" aria-hidden="true" />
        {list.length === 0 && !openFilm ? (
          <p className="empty">
            {halls.length === 0
              ? "Nessuna sala d'essai in questo raggio: allargalo dalle impostazioni."
              : tab === "sala"
                ? "Nessuna proiezione in questa sala, in questo giorno."
                : "Niente in programma qui, per ora."}
          </p>
        ) : (
          <section
            className="flow"
            aria-roledescription="carosello"
            aria-label={TABS.find(([k]) => k === tab)![1]}
            onWheel={onWheel}
            onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, moved: false })}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || openFilm) return;
              if (Math.abs(e.clientX - d.x) > 40) {
                move(e.clientX < d.x ? 1 : -1);
                drag.current = { x: e.clientX, y: e.clientY, moved: true };
              }
            }}
            onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
            onPointerCancel={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
          >
            {list.map(({ f }, i) => {
              const d = i - safeIdx;
              const pos = Math.abs(d) <= 2 ? String(d) : "hidden";
              return (
                <button
                  key={f.id}
                  type="button"
                  className="cov"
                  data-pos={pos}
                  data-testid={d === 0 ? "cover-active" : undefined}
                  tabIndex={pos === "hidden" || openFilm ? -1 : 0}
                  aria-hidden={pos === "hidden"}
                  aria-label={d === 0 ? `Apri gli orari di ${f.title}` : `Mostra ${f.title}`}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    if (d === 0) open(f);
                    else setIdx(i);
                  }}
                >
                  <Poster f={f} eager={Math.abs(d) <= 2} />
                </button>
              );
            })}
          </section>
        )}

        {openFilm && (
          <section className="panel" aria-label={`Orari di ${openFilm.title}`} data-testid="panel">
            <div
              className="ph"
              onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, moved: false })}
              onPointerUp={(e) => {
                if (drag.current && e.clientY - drag.current.y > 60) close();
                drag.current = null;
              }}
            >
              <button type="button" className="thumb" onClick={close} aria-label="Torna alle locandine">
                <Poster f={openFilm} eager />
              </button>
              <div>
                <h2 className="disp">{openFilm.title}</h2>
                <p className="meta">{[openFilm.director, openFilm.year, openFilm.runtime ? `${openFilm.runtime}′` : null].filter(Boolean).join(", ")}</p>
                {tags(openFilm).length > 0 && <p className="tags">{tags(openFilm).join(", ")}</p>}
                <p className="links">
                  <a href={trailerUrl(openFilm)} target="_blank" rel="noopener">
                    Trailer
                  </a>
                  <a href={letterboxdUrl(openFilm)} target="_blank" rel="noopener">
                    Letterboxd
                  </a>
                </p>
              </div>
              <button type="button" className="icon close" onClick={close} aria-label="Chiudi">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            {panelRows.length === 0 ? (
              <p className="empty">Nessuna proiezione in programma.</p>
            ) : (
              <ul className="rows" role="listbox" aria-label="Proiezioni" tabIndex={0}>
                {panelRows.map(({ s, c, km }, i) => (
                  <li
                    key={`${c.id}-${s.startsAt}`}
                    className="row"
                    role="option"
                    aria-selected={i === sel}
                    data-row={i}
                    data-testid="row"
                    onClick={() => setSel(i)}
                  >
                    <span className="cin">{c.name}</span>
                    <span className="km">{fmtKm(km)}</span>
                    <span className="when">
                      {cap(when(s.startsAt))}
                      {s.vo && <span className="vo">v.o.</span>}
                    </span>
                    <span className="ra">
                      <a href={calendarUrl(openFilm, s, c.name)} target="_blank" rel="noopener" aria-label={`Aggiungi al calendario: ${c.name}, ${when(s.startsAt)}`}>
                        Calendario
                      </a>
                      <a href={s.url ?? c.url} target="_blank" rel="noopener">
                        Biglietti
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {cur && !openFilm && (
          <div className="info">
            <h2 className="t disp">
              <button type="button" onClick={() => open(cur.f)}>
                {cur.f.title}
              </button>
            </h2>
            {(cur.f.director || cur.f.year) && <p className="meta">{[cur.f.director, cur.f.year].filter(Boolean).join(", ")}</p>}
            {first && (
              <p className={`next${urgency?.startsWith("ultima") || urgency === "solo oggi" ? " urgent" : ""}`}>
                {/* one evening left: the line itself is the warning; several: say how many first */}
                {urgency?.startsWith("ultime") && <span className="urgent">{cap(urgency)}. </span>}
                {urgency?.startsWith("ultima") ? "Ultima: " : urgency === "solo oggi" ? "Solo oggi: " : ""}
                {urgency?.startsWith("ultima") || urgency === "solo oggi" ? longDay.format(new Date(first.startsAt)) : cap(longDay.format(new Date(first.startsAt)))}{" "}
                {hhmm(first.startsAt)}, {cinemaName(first.cinemaId).replace(/^Cin(ema|eteca) /, "")}
              </p>
            )}
          </div>
        )}
      </main>

      <nav className="bar" aria-label="Viste">
        {tab === "sala" && (
          <div className="filters">
            <label className="sr" htmlFor="sala">
              Sala
            </label>
            <select id="sala" value={selHall ?? ""} onChange={(e) => setHall(e.target.value)}>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}, {fmtKm(h.km)}
                </option>
              ))}
            </select>
            <label className="sr" htmlFor="giorno">
              Giorno
            </label>
            <select id="giorno" value={selDay} onChange={(e) => setDay(e.target.value)}>
              {days.map((k, i) => (
                <option key={k} value={k}>
                  {i === 0 ? "Oggi" : `${cap(weekday(new Date(`${k}T12:00:00Z`)))} ${dayNum(new Date(`${k}T12:00:00Z`))}`}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="bar-row">
          <div className="views" role="group" aria-label="Selezione">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => {
                  if (openFilm) close();
                  setTab(k);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="icon" onClick={() => setSettings(true)} aria-label="Impostazioni: posizione e raggio" aria-haspopup="dialog">
            <SlidersHorizontal size={20} strokeWidth={1.5} />
          </button>
        </div>
      </nav>

      {settings && (
        <div className="sheet-scrim" onClick={() => setSettings(false)}>
          <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-h" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2 id="settings-h" className="disp">
                Impostazioni
              </h2>
              <button type="button" className="icon" onClick={() => setSettings(false)} aria-label="Chiudi le impostazioni">
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <label htmlFor="quartiere">Da dove parti</label>
            <select
              id="quartiere"
              value={place.precise ? "" : place.label}
              onChange={(e) => {
                const q = QUARTIERI.find((x) => x.label === e.target.value);
                if (q) setPlace({ ...q, radiusKm: place.radiusKm, precise: false });
              }}
            >
              <option value="" disabled>
                {place.precise ? "La tua posizione" : "Scegli un quartiere"}
              </option>
              {QUARTIERI.map((q) => (
                <option key={q.label}>{q.label}</option>
              ))}
            </select>
            <button type="button" className="textbtn" onClick={() => locate(place.radiusKm)}>
              {asking ? "Cerco la posizione…" : "Usa la mia posizione"}
            </button>
            {denied && <p className="hint">Posizione non disponibile: scegli un quartiere.</p>}
            <label htmlFor="raggio">Quanto lontano</label>
            <select id="raggio" value={place.radiusKm} onChange={(e) => setPlace({ ...place, radiusKm: Number(e.target.value) })}>
              {[2, 3, 5, 8, 12, 20].map((k) => (
                <option key={k} value={k}>
                  Entro {k} km ({cinemasInRadius(board.cinemas, { ...place, radiusKm: k }).length} sale)
                </option>
              ))}
            </select>
            <p className="sheet-foot">
              <Link href="/account">Collega Letterboxd</Link>
              <span>{cap(board.freshness.label)}</span>
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
