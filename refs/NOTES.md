# Reference — note (2026-11-20)

Token veri estratti con dembrandt (viewport mobile richiesto, il tool ha renderizzato a 1920).

## MUBI (mubi.com/it)
- Superficie bianca `#ffffff`, testo `#000000`, accento navy `#001489` (CTA piene, bordo 2px).
- Tipografia: **Riforma** (grotesk) per quasi tutto, maiuscolo su display/CTA; **Tiempos Headline/Text** (serif) per i titoli editoriali; **K-Compress** (condensed) per il display.
- Raggi 0-2px, bottoni squadrati 13×25px, separatori 1px. Transizioni 0.2-0.3s `ease`.
- Lezione: il cinema d'autore si legge come una rivista, non come un'app di streaming. Pochissimo colore, gerarchia data dalla tipografia.

## Criterion (criterion.com)
- Fondo antracite `#252525` sul 99% dell'area, testo bianco, oro `#b4841e` per logo e link, grigio `#8e8e8e` per il secondario.
- Tipografia: **Mercury Text** (serif) per titoli e corpo, **Gotham Narrow** maiuscolo con tracking 1px per le etichette.
- Easing firma `cubic-bezier(0.23, 1, 0.32, 1)` a 0.5s su tutto (link e bottoni).
- Lezione: serif + etichette condensed maiuscole = "collezione", "archivio". Il buio non è nero puro.

## Letterboxd, Metrograph, Fondazione Prada
- Bloccati dal browser automatico (Cloudflare). Letterboxd risponde normalmente a una fetch semplice; **Fondazione Prada (Godard) blocca anche la fetch semplice → serve una fonte alternativa per lo scraper.**

## Prototipo (da superare)
- `#0b0b0d` + giallo `#ffcc33` + Inter, chip arrotondati, Cover Flow con riflesso `-webkit-box-reflect`. Il Cover Flow funziona: tenere la meccanica, rifare la pelle.

## Default da evitare (nominati)
Inter/Geist come unico font; grigio-quasi-nero + un solo accento giallo/acido; chip a pillola ovunque; card arrotondate con ombra morbida; gradiente radiale sul fondo; emoji come icone; titoli in maiuscolo mono.
