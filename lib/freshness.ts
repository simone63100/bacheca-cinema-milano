/**
 * Freshness guard (SPEC): if the last successful scrape is older than 26h →
 * one admin alert per stale episode + a "dati del <giorno>" banner on the site.
 */
export const STALE_AFTER_HOURS = 26;

export interface FreshnessState {
  stale: boolean;
  /** Banner text for the site, null when fresh. */
  banner: string | null;
  /** "aggiornato oggi" / "aggiornato ieri" / "dati del …". */
  label: string;
  /** true only once per stale episode (the caller records `lastOkRunId` as alerted). */
  alertAdmin: boolean;
}

export function freshness(
  lastOk: { id: number; finishedAt: string } | null,
  now: Date,
  alreadyAlertedForRun: number | null,
  city: { tz: string; staleAfterHours: number } = { tz: "Europe/Rome", staleAfterHours: STALE_AFTER_HOURS },
): FreshnessState {
  if (!lastOk) {
    return { stale: true, banner: "Dati non ancora disponibili", label: "in attesa del primo aggiornamento", alertAdmin: alreadyAlertedForRun !== 0 };
  }
  const t = new Date(lastOk.finishedAt);
  const hours = (now.getTime() - t.getTime()) / 3_600_000;
  const day = new Intl.DateTimeFormat("it-IT", { timeZone: city.tz, weekday: "long", day: "numeric", month: "long" }).format(t);
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: city.tz });
  const today = f.format(now) === f.format(t);
  const yesterday = f.format(new Date(now.getTime() - 86_400_000)) === f.format(t);
  const stale = hours > city.staleAfterHours;
  return {
    stale,
    banner: stale ? `Dati del ${day}` : null,
    label: today ? "aggiornato oggi" : yesterday ? "aggiornato ieri" : `dati del ${day}`,
    alertAdmin: stale && alreadyAlertedForRun !== lastOk.id,
  };
}
