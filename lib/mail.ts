/** Resend over plain fetch (works in Workers and Neon Functions). No addresses are ever logged. */
import { CINEMAS } from "./cinemas";
import type { FomoFilm, FomoHit } from "./fomo";
import { when } from "./view";

const RULE_LABEL: Record<FomoHit["rule"], string> = {
  watchlist_last: "dalla tua watchlist, sta per uscire dalle sale",
  loved_special: "uno dei tuoi film del cuore, in proiezione speciale",
  rare_event: "dalle tue liste, solo una o due proiezioni",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderFomoMail(hits: FomoHit[], films: FomoFilm[], siteUrl: string) {
  const name = (id: string) => CINEMAS.find((c) => c.id === id)?.name ?? id;
  const blocks = hits.map((h) => {
    const f = films.find((x) => x.filmId === h.filmId)!;
    const rows = h.screenings
      .slice(0, 6)
      .map((s) => `<tr><td style="padding:4px 0;font:15px Georgia,serif;color:#1a2647">${esc(name(s.cinemaId))}</td><td style="padding:4px 0;text-align:right;font:15px Helvetica,Arial,sans-serif;color:#1a2647">${esc(when(s.startsAt))}</td></tr>`)
      .join("");
    return `<div style="margin:0 0 28px">
      <p style="margin:0;font:600 11px Helvetica,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8f1620">${esc(RULE_LABEL[h.rule])}</p>
      <h2 style="margin:6px 0 8px;font:500 30px Georgia,serif;color:#1a2647"><a href="${siteUrl}/film/${h.filmId}" style="color:#1a2647;text-decoration:none">${esc(f.title)}</a></h2>
      <table style="width:100%;border-top:1px solid #1a2647;border-collapse:collapse">${rows}</table></div>`;
  });
  const titles = hits.map((h) => films.find((f) => f.filmId === h.filmId)!.title);
  const subject = titles.length === 1 ? `Bijoux · ${titles[0]}` : `Bijoux · ${titles[0]} e altri ${titles.length - 1}`;
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#f3c9d1;padding:24px">
  <div style="max-width:520px;margin:0 auto;border:1.5px solid #1a2647;padding:6px"><div style="border:1px solid #1a2647;padding:28px 26px;background:#f3c9d1">
  <p style="margin:0 0 22px;text-align:center;font:italic 34px Georgia,serif;color:#1a2647">Bijoux</p>
  ${blocks.join("")}
  <p style="margin:24px 0 0;font:12px Helvetica,Arial,sans-serif;color:#1a2647">Ti scriviamo solo quando stai per perderti qualcosa, al massimo una volta al giorno. <a href="${siteUrl}/account" style="color:#1a2647">Impostazioni</a></p>
  </div></div></body></html>`;
  const text = hits
    .map((h) => {
      const f = films.find((x) => x.filmId === h.filmId)!;
      return `${f.title} (${RULE_LABEL[h.rule]})\n${h.screenings.slice(0, 6).map((s) => `  ${name(s.cinemaId)} · ${when(s.startsAt)}`).join("\n")}`;
    })
    .join("\n\n");
  return { subject, html, text: `${text}\n\n${siteUrl}/account` };
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) throw new Error("RESEND_API_KEY / MAIL_FROM mancanti");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}`);
  return (await r.json()) as { id: string };
}
