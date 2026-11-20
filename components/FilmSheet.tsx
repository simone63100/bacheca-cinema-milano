"use client";
import Link from "next/link";
import { useMemo } from "react";
import type { BoardFilm } from "@/lib/board";
import type { Cinema } from "@/lib/types";
import { distanceKm } from "@/lib/geo";
import { calendarUrl, fmtKm, letterboxdUrl, metaLine, trailerUrl, when } from "@/lib/view";
import { usePlace } from "./usePlace";

export function FilmSheet({ film, cinemas }: { film: BoardFilm; cinemas: Cinema[] }) {
  const { place } = usePlace();
  const groups = useMemo(() => {
    const m = new Map<string, BoardFilm["screenings"]>();
    for (const s of film.screenings) m.set(s.cinemaId, [...(m.get(s.cinemaId) ?? []), s]);
    return [...m.entries()]
      .map(([id, rows]) => {
        const c = cinemas.find((x) => x.id === id)!;
        return { c, rows, km: distanceKm(place, c) };
      })
      .sort((a, b) => (a.km <= place.radiusKm ? 0 : 1) - (b.km <= place.radiusKm ? 0 : 1) || a.km - b.km);
  }, [film.screenings, cinemas, place]);

  const anyVo = film.screenings.some((s) => s.vo) && film.screenings.every((s) => s.vo);
  const firstNear = groups[0]?.rows[0];

  return (
    <main className="page sh">
      <Link className="lab back" href="/">
        ‹ la bacheca
      </Link>
      <div className="post">
        {film.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote poster, no image optimizer on Workers free
          <img src={film.poster} alt={`Locandina di ${film.title}`} referrerPolicy="no-referrer" />
        ) : (
          <span className="noposter">{film.title}</span>
        )}
      </div>
      <h1 className="disp">{film.title}</h1>
      {film.originalTitle && film.originalTitle !== film.title && <p className="m">{film.originalTitle}</p>}
      <p className="m">{metaLine(film, anyVo)}</p>

      <div className="tb" data-testid="orari">
        {groups.map(({ c, rows, km }) => (
          <section key={c.id} aria-label={c.name} data-testid="sala">
            <div className="cn">
              <b>{c.name}</b>
              <span className="lab">{fmtKm(km)}</span>
            </div>
            {rows.map((s) => (
              <div className="sl" key={s.startsAt}>
                <a href={s.url ?? c.url} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                  {when(s.startsAt)}
                  {s.vo && <i>V.O.</i>}
                  {s.special && <i>EVENTO</i>}
                </a>
                <a className="cal" href={calendarUrl(film, s, c.name)} target="_blank" rel="noopener" aria-label={`Aggiungi al calendario: ${when(s.startsAt)}`}>
                  + cal
                </a>
              </div>
            ))}
          </section>
        ))}
      </div>

      <div className="acts">
        <a className="p" href={firstNear?.url ?? groups[0]?.c.url ?? "#"} target="_blank" rel="noopener">
          Biglietti
        </a>
        <a href={trailerUrl(film)} target="_blank" rel="noopener">
          Trailer
        </a>
        <a href={letterboxdUrl(film)} target="_blank" rel="noopener">
          Letterboxd
        </a>
      </div>
    </main>
  );
}
