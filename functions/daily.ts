/**
 * Neon Function `daily` — invoked once a day by a Neon schedule trigger (never GitHub Actions).
 * scrape 13 cinemas → match TMDB → upsert → Letterboxd → FOMO mails → freshness guard.
 * DATABASE_URL is injected by Neon; TMDB_TOKEN, RESEND_API_KEY, MAIL_FROM, ADMIN_EMAIL,
 * SITE_URL, CRON_SECRET are function environment variables.
 */
import { CINEMAS } from "../lib/cinemas";
import { q } from "../lib/db";
import { refreshLetterboxd } from "../lib/lbsync";
import { renderFomoMail, sendMail } from "../lib/mail";
import { runDaily } from "../lib/pipeline";
import { scrape } from "../scrapers";

async function handle(request: Request): Promise<Response> {
  const fromTrigger = !!request.headers.get("x-neon-trigger-invocation-id");
  const secret = process.env.CRON_SECRET;
  const manual = !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
  if (request.method !== "POST" || !(fromTrigger || manual)) return new Response("not found", { status: 404 });

  const now = new Date();
  const site = process.env.SITE_URL ?? "";
  const scraped = await Promise.all(
    CINEMAS.map(async (c) => {
      try {
        return { cinemaId: c.id, rows: await scrape(c.id, now), error: null };
      } catch (e) {
        return { cinemaId: c.id, rows: [], error: (e as Error).message };
      }
    }),
  );

  const result = await runDaily({
    now,
    scraped,
    refreshLetterboxd,
    sendFomo: async (userId, hits, films) => {
      const [u] = await q<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
      if (!u) return;
      const m = renderFomoMail(hits, films, site);
      await sendMail(u.email, m.subject, m.html, m.text);
    },
    alertAdmin: async (text) => {
      if (process.env.ADMIN_EMAIL) await sendMail(process.env.ADMIN_EMAIL, "Bijoux: dati vecchi", `<p>${text}</p>`, text);
    },
  });

  const summary = Object.fromEntries(scraped.map((s) => [s.cinemaId, s.error ? `errore: ${s.error}` : s.rows.length]));
  console.log(`daily run ${result.runId}: ${result.okCount}/13 sale`, JSON.stringify(summary));
  return Response.json({ ok: true, ...result, summary });
}

const handler = { fetch: handle };
export default handler;
