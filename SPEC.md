# Bijoux — v1 (repo: bacheca-cinema-milano)

## Obiettivo
Per un cinefilo milanese che oggi controlla a mano 10+ siti di sale diverse: un solo sito che mostra cosa passa nelle sale d'essai entro il suo raggio, e che, se collega Letterboxd, gli manda una mail quando sta per perdersi un film che gli interessa.

## Decisioni prese (grilling 2026-11-20)
- **Copertura: 13 sale d'essai/indipendenti, uno scraper per sito.** Palestrina, Cineteca Arlecchino, Cineteca MIC, Cinema Godard (Fondazione Prada), Anteo Palazzo del Cinema, Anteo CityLife, Colosseo, Beltrade, Arcobaleno, Cinemino, Ariosto, Centrale, Mexico. Dati ricchi (v.o., restauri, rassegne) = il vantaggio che gli aggregatori non hanno. Multisala via aggregatore: dopo, se richiesto.
- **Verifica di raggiungibilità (2026-11-20):** fetch semplice da server OK per Letterboxd (watchlist + id TMDB nella pagina film), Cineteca Milano, Palestrina, spaziocinema. **Fondazione Prada (Godard) risponde 403 con challenge Cloudflare** → per il Godard serve una fonte alternativa (feed/API interna, pagina terza, o aggregatore) da trovare nel primo giro; Beltrade non ha risposto su `beltradecinema.it` (verificare il dominio).
- **Nessuna compilazione a mano.** Lo scraper vive nel repo. Il `data.json` del prototipo era scritto a mano da una sessione Claude, nessuno script esiste.
- **Aggiornamento 1 volta al giorno**, non settimanale (le rassegne escono settimane prima). **Mai cron su GitHub Actions** (sempre fallito nei progetti precedenti). Scheduler = **Neon Functions + schedule trigger** (beta).
- **Guardia di freschezza:** se l'ultimo scraping riuscito ha più di 26h → un solo avviso all'admin + banner "dati del <giorno>" sul sito. Mai una mail di errore al giorno.
- **Input utente:** (1) posizione dal browser (`navigator.geolocation`, con permesso), fallback indirizzo/quartiere; raggio in km regolabile; ogni sala ha lat/lng nel DB. (2) Letterboxd opzionale.
- **Letterboxd:** A = username → watchlist + film visti/voti pubblici letti dal server 1 volta al giorno (scraping, zona grigia: rate limit basso, cache). B = upload CSV come riserva. C = richiesta API a api@letterboxd.com da mandare quando il sito v1 è online e mostrabile.
- **Matching film:** tramite id TMDB (titolo italiano ↔ originale ↔ Letterboxd). LLM economico solo per i casi ambigui (v.o., titolo non trovato).
- **Sito aperto senza login.** Login (Neon Auth) solo per collegare Letterboxd e ricevere mail: **email e password** oppure **Google** (email e password aggiunte il 2026-11-26, su richiesta di Alberto). Reset password con codice via mail. Niente magic link.
- **Mail solo FOMO, mai newsletter di novità.** Max 1 mail al giorno per utente, nessuna se non c'è niente. Regole:
  1. watchlist: ultima proiezione entro il raggio tra ≤3 giorni; se è un film non di prima visione (riproposto) → appena rilevato;
  2. visti con voto ≥4★ o preferiti: appena rilevati, **solo se restauro o proiezione speciale**;
  3. film in lista con ≤2 proiezioni totali (evento): appena rilevato.
  Ogni film/utente notificato una sola volta per regola.
- **UI:** una sola interfaccia, mobile-first. Cover Flow in alto ("per te", "stasera"); **clic sulla copertina → scheda** con orari raggruppati per sala, + calendario, trailer, link sala. Sotto, **vista elenco per sala e per giorno**. Lo stile Zune si toglie del tutto. Direzione estetica: 2-3 artboard, sceglie il team.
- **Direzione visiva sostituita il 2026-11-22 da `TODO.md` ("Arcanine al buio": fondo nero, Cover Flow stile iPod a schermata unica, pannello orari al posto della scheda).** Sotto, la direzione precedente per storico.
- **Nome: Bijoux.** Direzione **"Mendl's"** (scelta il 2026-11-20 fra 6 proposte, riferimento visivo: `refs/bijoux.html` sezione 1 e `refs/bijoux.png` in alto). Mondo: Grand Budapest Hotel × Velluto blu × la lounge anni '70 di *Tranquility Base Hotel & Casino*; sale d'essai che resistono al tempo, eleganza ironica e colta.
  - Colori: rosa cipria `#f3c9d1` = superficie; rosa chiaro `#f9e2e6` = passe-partout delle locandine; navy `#1a2647` = inchiostro, testo, cornici; rosso `#b3202a` = solo urgenza (nastro "ultime N sere") e azione primaria (Biglietti).
  - Tipografia: Fraunces (SOFT 100, opsz alto) per i titoli dei film; Fraunces corsivo per regista/anno e nomi delle sale; Jost maiuscolo con tracking 0.2em per etichette e tab; Pinyon Script solo per il monogramma.
  - Firma: monogramma **"Bijoux" ricamato** come su un accappatoio d'hotel (SVG: riempimento + filo tratteggiato + leggero rumore); doppia cornice tipo carta intestata; composizione simmetrica e centrata; locandine con passe-partout chiaro e filetto navy; nastro rosso a coda di rondine per l'urgenza; bottoni a pillola con filetto navy.
  - Scartate: Sala buia, Archivio, Insegna, Sipario (rosso dominante: bocciata), Mendl's × Godard. Il Velluto (fondo navy) piace: possibile **modalità notte** dopo la v1, da confermare.
  - Da evitare: pastelli ovunque e Futura dappertutto (Wes Anderson in costume), card arrotondate con ombra morbida, gradienti, emoji come icone.
- **Stack:** Next.js su **Cloudflare Workers** (OpenNext) da subito — il piano free ammette uso commerciale, niente migrazione da Vercel quando si monetizza. Neon (Postgres + Auth + Functions). Resend per le mail. Dominio sull'account Cloudflare esistente.
- **Costi MVP: 0 €** (+ dominio ~10-15 €/anno). Monetizzazione prevista ma dopo: allora Resend Pro (20 $/mese oltre 100 mail/giorno) e licenza TMDB commerciale o altra fonte per le locandine.
- **Etichette per film** salvate già in v1 (d'autore, classico/restaurato, v.o., prima visione), per abilitare dopo i profili di gusto.

## Fuori scope v1
- Profili di gusto all'onboarding, sezione "Esplora" stile Pinterest (etichette pronte, UI dopo).
- App nativa iOS/Android (Expo, push). Nota: su iOS con login Google serve anche **Sign in with Apple** (App Store 4.8).
- Push web, multisala/aggregatori, altre città, monetizzazione, newsletter novità.

## File e interfacce coinvolti
- `app/` — Next.js (pagine: home con Cover Flow + elenco, scheda film, impostazioni account).
- `scrapers/<sala>.ts` — un modulo per sala, firma comune `scrape(): Promise<Screening[]>`; `scrapers/__fixtures__/<sala>.html` per i test.
- `functions/daily.ts` — Neon Function: scrape tutte le sale → normalizza → match TMDB → upsert → refresh Letterboxd utenti → valuta regole FOMO → invia mail.
- `db/schema.sql` — `cinemas(id, name, lat, lng, url)`, `films(id, tmdb_id, title, original_title, director, year, poster, tags[])`, `screenings(film_id, cinema_id, starts_at, vo, special, url)`, `users`, `user_films(user_id, tmdb_id, kind: watchlist|seen|favorite, stars)`, `notifications(user_id, film_id, rule, sent_at)`, `runs(started_at, ok, per_cinema jsonb)`.
- Il prototipo (`index.html`, `data.json`, `targets.json`, `posters/`) va in `legacy/` come riferimento, poi si cancella.

## Pass bar
- [ ] `pnpm typecheck && pnpm lint && pnpm build` esce 0.
- [ ] `pnpm test` esce 0, e include:
  - [ ] un test per ognuna delle 13 sale su fixture HTML salvata: ≥1 proiezione con titolo, data, ora e sala valorizzati (un parser che restituisce 0 righe **fallisce**);
  - [ ] le 3 regole FOMO + "nessuna mail se nessun match" + "max 1 mail/giorno" + "mai due volte lo stesso film/regola";
  - [ ] filtro raggio: sale dentro/fuori un raggio dato su coordinate note;
  - [ ] guardia di freschezza: run vecchio di 27h → banner + avviso, 25h → niente.
- [ ] `pnpm scrape --dry` dal vivo: ≥11 sale su 13 restituiscono ≥1 proiezione futura; il report elenca quelle a 0.
- [ ] Matching TMDB su un set etichettato a mano di 40 titoli dalle sale: ≥90% corretti (`pnpm eval:match`).
- [ ] Letterboxd: dato un username pubblico di test, la watchlist letta coincide col CSV esportato dallo stesso account per ≥95% dei titoli.
- [ ] E2E Playwright (375px e 1280px): visita anonima con geolocalizzazione simulata → solo sale nel raggio; clic copertina → scheda con orari per sala; vista elenco per sala/giorno; nessuno scroll orizzontale.
- [ ] Deploy Cloudflare: l'URL risponde 200 e mostra "aggiornato oggi" dopo il trigger.
- [ ] Neon schedule trigger: 3 run consecutivi riusciti nella tabella `runs`, in 3 giorni diversi.
- [ ] Login Google sul deploy + mail FOMO reale ricevuta su un account di test (screenshot).
- [ ] *(sostituito dai criteri di accettazione di `TODO.md`)* Screenshot a 390px di home e scheda accanto a `refs/bijoux.png` (Mendl's): stessi token colore (verificati con `getComputedStyle`), stessi font, monogramma ricamato, doppia cornice, passe-partout, nastro rosso; Lighthouse accessibility ≥90 (il navy su rosa e il rosa chiaro su rosso passano il contrasto AA).
