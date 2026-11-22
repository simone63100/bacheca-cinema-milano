# TODO — restyle Bijoux (richiesta di Piero, 2026-11-22)

Sostituisce la direzione visiva "Mendl's" di `SPEC.md` (rosa cipria + navy). Il resto dello SPEC (scraper, mail FOMO, stack) non cambia.

## Direzione: "Arcanine al buio"
Sala scura, locandina accesa. Riferimento: il set LEGO Arcanine #72160 (scatola nera con alone caldo dietro il pezzo).

- [ ] **Sfondo nero** `#0d0c0b` (non nero puro, non rosa). Il rosa è tolto: le locandine devono avere il massimo risalto.
- [ ] **Palette Arcanine**, solo come accenti:
  - arancio `#f08a1f` = azione primaria, tab attivo, nastro "ultime N sere" (sostituisce il rosso)
  - sabbia `#dcc196` = testo secondario, filetti, regista/anno
  - nero-striscia `#1b1b1d` = superfici dei pannelli
  - testo principale `#f6ede0` (bianco caldo)
  - viola-lingua `#c98bb5` = un solo uso (es. "in watchlist"), da valutare
- [ ] **Alone dietro la locandina centrale** (la "sfumatura" della scatola LEGO): sì, ma ricavato **dalla locandina stessa** (colore dominante, sfumato e a bassa opacità), non fisso arancio. Così l'alone cambia a ogni film come la luce del proiettore. L'arancio resta solo per l'interfaccia. Fallback arancio se il colore non si estrae.
- [ ] **Togliere il ricamato**: via il monogramma SVG, il filo tratteggiato, il rumore, la doppia cornice.
- [ ] **Logo "Bijoux" leggibile**: via Pinyon Script (la "y" non si legge). Usare Fraunces (SOFT 100) in sabbia/arancio, grande e netto. Verificare a 390px e 1280px.
- [ ] Via anche: passe-partout rosa attorno alle locandine, nastro a coda di rondine in rosso. Le locandine hanno solo un filetto sottile sabbia.
- [ ] Tipografia: Fraunces per titoli, Jost maiuscolo con tracking per etichette e tab. Niente altri font.

## Locandine più grandi
- [ ] Locandina centrale alta almeno ~60% dell'altezza visibile (oggi ~45%). Le laterali scalate di conseguenza, con riflesso (`-webkit-box-reflect`) come nel prototipo nero.
- [ ] Verificare che la centrale non venga tagliata a 375px di larghezza.

## Comportamento stile iPod Cover Flow (niente pagina nuova)
- [ ] **Nessuno scroll della pagina**: layout a `100dvh`, `overflow: hidden` sul body. Tutto sta in una schermata.
- [ ] Barra in alto stile schermo iPod: "Cover Flow" a sinistra, filtri a destra (per te / stasera / per sala, raggio).
- [ ] **Clic sulla locandina = la locandina si gira / lascia il posto a un pannello nella stessa schermata**, come l'iPod mostra le tracce dell'album. Niente `/film/[id]` e niente navigazione.
- [ ] Il pannello è una **lista**: una riga per proiezione. Intestazione = titolo + regista, anno, tag (v.o., restaurato, watchlist). Righe = **cinema, giorno, orario** (le righe sono i "brani"). Riga selezionata evidenziata in arancio, come la barra blu dell'iPod.
- [ ] Solo questa lista scorre (internamente) se ha molte righe. La pagina no.
- [ ] Azioni per riga: **+ calendario**, **biglietti / sito sala**. Azioni in intestazione: **trailer**, **Letterboxd**.
- [ ] Uscita dal pannello: clic sulla locandina, tasto Esc, freccia sinistra, swipe verso il basso. La locandina torna al suo posto nel Cover Flow.
- [ ] Navigazione: frecce sinistra/destra, rotella, swipe, tap sulle laterali. Su desktop anche invio per aprire il pannello.
- [ ] La vista "per sala / per giorno" dello SPEC diventa un filtro dentro la stessa schermata, non una sezione sotto (niente scroll).

## Da decidere insieme (aperto)
- [ ] Il viola della lingua serve o è troppo? Si decide guardando una prova a schermo.
- [ ] Intensità dell'alone: basso e discreto o forte come sulla scatola LEGO? Proposta: partire basso (~25-35% di opacità), regolare a occhio.
- [ ] Modalità chiara: nessuna. Solo scuro.

## Criterio di accettazione
- [ ] A 390px e 1280px: nessuno scroll della pagina, in nessuna schermata.
- [ ] Clic su una locandina → pannello con cinema e orari nella stessa pagina, l'URL non cambia.
- [ ] Screenshot a 390px e 1280px: sfondo nero, accenti arancio/sabbia, logo "Bijoux" leggibile (la "y" si distingue), locandina centrale più grande di quella attuale.
- [ ] Alone cambia colore passando da un film all'altro.
- [ ] Contrasto AA su testo sabbia/bianco su nero e su arancio.
