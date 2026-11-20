import type { Cinema, CinemaId } from "./types";

export const CINEMAS: Cinema[] = [
  { id: "palestrina", name: "Palestrina", lat: 45.4808, lng: 9.2152, url: "https://www.progettolumiere.it/palestrina/home.php", source: "https://www.progettolumiere.it/palestrina/home.php" },
  { id: "arlecchino", name: "Cineteca Arlecchino", lat: 45.4665, lng: 9.1966, url: "https://www.cinetecamilano.it/luogo/cineteca-milano-arlecchino/", source: "https://arlecchino.cinetecadimilano.18tickets.it/" },
  { id: "mic", name: "Cineteca MIC", lat: 45.5196, lng: 9.2119, url: "https://www.cinetecamilano.it/luogo/cineteca-milano-mic/", source: "https://mic.cinetecadimilano.18tickets.it/" },
  { id: "godard", name: "Cinema Godard", lat: 45.4446, lng: 9.2046, url: "https://www.fondazioneprada.org/cinema-godard/", source: "https://fondazioneprada.org/wp-content/uploads/CinemaGodard_programma.pdf" },
  { id: "anteo", name: "Anteo Palazzo del Cinema", lat: 45.4797, lng: 9.1865, url: "https://www.spaziocinema.info/", source: "https://anteo.spaziocinema.18tickets.it/" },
  { id: "citylife", name: "Anteo CityLife", lat: 45.4777, lng: 9.1563, url: "https://www.spaziocinema.info/", source: "https://citylife.spaziocinema.18tickets.it/" },
  { id: "colosseo", name: "Colosseo", lat: 45.4578, lng: 9.2049, url: "https://www.ilregnodelcinema.com/colosseo/", source: "https://www.ilregnodelcinema.com/colosseo/" },
  { id: "beltrade", name: "Beltrade", lat: 45.4972, lng: 9.2229, url: "https://bandhi.it/bah/beltrade/", source: "https://bandhi.it/bah/beltrade/wp-content/uploads/sites/2/beltrade.ics" },
  { id: "arcobaleno", name: "Arcobaleno", lat: 45.4791, lng: 9.2056, url: "https://movieplayer.it/cinema/arcobaleno-filmcenter_759/", source: "https://movieplayer.it/cinema/arcobaleno-filmcenter_759/" },
  { id: "cinemino", name: "Cinemino", lat: 45.4532, lng: 9.2081, url: "https://www.ilcinemino.it/programmazione/", source: "https://www.ilcinemino.it/programmazione/" },
  { id: "ariosto", name: "Ariosto", lat: 45.4693, lng: 9.1702, url: "https://www.spaziocinema.info/", source: "https://ariosto.spaziocinema.18tickets.it/" },
  { id: "centrale", name: "Centrale", lat: 45.4609, lng: 9.1847, url: "https://movieplayer.it/cinema/centrale_767/", source: "https://movieplayer.it/cinema/centrale_767/" },
  { id: "mexico", name: "Mexico", lat: 45.4529, lng: 9.1607, url: "https://movieplayer.it/cinema/mexico_780/", source: "https://movieplayer.it/cinema/mexico_780/" },
];

export const cinemaById = (id: CinemaId): Cinema => {
  const c = CINEMAS.find((x) => x.id === id);
  if (!c) throw new Error(`sala sconosciuta: ${id}`);
  return c;
};
