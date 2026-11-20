# Bijoux (bacheca-cinema-milano)

Leggi prima `SPEC.md`: decisioni, fuori scope e pass bar. La direzione visiva è `refs/bijoux.html` sezione 1 "Mendl's".

## Comandi (pass bar)
- `pnpm typecheck && pnpm lint && pnpm build`
- `pnpm test` — parser delle 13 sale su fixture, regole FOMO, raggio, guardia di freschezza
- `pnpm scrape --dry` — scraping dal vivo, report per sala (≥11/13 con proiezioni)
- `pnpm eval:match` — matching TMDB su 40 titoli etichettati (≥90%)
- `pnpm e2e` — Playwright a 375px e 1280px con geolocalizzazione simulata

## Regole
- **Mai cron su GitHub Actions.** Lo scheduler è un Neon schedule trigger, 1 volta al giorno.
- Un parser che restituisce 0 proiezioni è un errore, non un successo.
- Niente segreti nel repo: chiavi Neon, Resend, TMDB, Google OAuth solo in `.dev.vars` / secret di Cloudflare e Neon.
- Scraping cortese: 1 richiesta per pagina, User-Agent dichiarato, cache, niente retry a raffica. Letterboxd: solo profili pubblici, 1 volta al giorno per utente.
- Nessun dato personale degli utenti (email, watchlist) in log, fixture o commit.
- Hosting: Cloudflare Workers (OpenNext). Non introdurre dipendenze da Vercel.
- Il prototipo resta in `legacy/` finché la v1 non lo sostituisce.
