import type { CityId } from "./cities";
import type { Cinema, CinemaId } from "./types";

export const CINEMAS: Cinema[] = [
  { id: "palestrina", city: "milano", name: "Palestrina", lat: 45.4808, lng: 9.2152, url: "https://www.progettolumiere.it/palestrina/home.php", source: "https://www.progettolumiere.it/palestrina/home.php" },
  { id: "arlecchino", city: "milano", name: "Cineteca Arlecchino", lat: 45.4665, lng: 9.1966, url: "https://www.cinetecamilano.it/luogo/cineteca-milano-arlecchino/", source: "https://arlecchino.cinetecadimilano.18tickets.it/" },
  { id: "mic", city: "milano", name: "Cineteca MIC", lat: 45.5196, lng: 9.2119, url: "https://www.cinetecamilano.it/luogo/cineteca-milano-mic/", source: "https://mic.cinetecadimilano.18tickets.it/" },
  { id: "godard", city: "milano", name: "Cinema Godard", lat: 45.4446, lng: 9.2046, url: "https://www.fondazioneprada.org/cinema-godard/", source: "https://fondazioneprada.org/wp-content/uploads/CinemaGodard_programma.pdf" },
  { id: "anteo", city: "milano", name: "Anteo Palazzo del Cinema", lat: 45.4797, lng: 9.1865, url: "https://www.spaziocinema.info/", source: "https://anteo.spaziocinema.18tickets.it/" },
  { id: "citylife", city: "milano", name: "Anteo CityLife", lat: 45.4777, lng: 9.1563, url: "https://www.spaziocinema.info/", source: "https://citylife.spaziocinema.18tickets.it/" },
  { id: "colosseo", city: "milano", name: "Colosseo", lat: 45.4578, lng: 9.2049, url: "https://www.ilregnodelcinema.com/colosseo/", source: "https://www.ilregnodelcinema.com/colosseo/" },
  { id: "beltrade", city: "milano", name: "Beltrade", lat: 45.4972, lng: 9.2229, url: "https://bandhi.it/bah/beltrade/", source: "https://bandhi.it/bah/beltrade/wp-content/uploads/sites/2/beltrade.ics" },
  { id: "arcobaleno", city: "milano", name: "Arcobaleno", lat: 45.4791, lng: 9.2056, url: "https://movieplayer.it/cinema/arcobaleno-filmcenter_759/", source: "https://movieplayer.it/cinema/arcobaleno-filmcenter_759/", todayOnly: true },
  { id: "cinemino", city: "milano", name: "Cinemino", lat: 45.4532, lng: 9.2081, url: "https://www.ilcinemino.it/programmazione/", source: "https://www.ilcinemino.it/programmazione/" },
  { id: "ariosto", city: "milano", name: "Ariosto", lat: 45.4693, lng: 9.1702, url: "https://www.spaziocinema.info/", source: "https://ariosto.spaziocinema.18tickets.it/" },
  { id: "centrale", city: "milano", name: "Centrale", lat: 45.4609, lng: 9.1847, url: "https://movieplayer.it/cinema/centrale_767/", source: "https://movieplayer.it/cinema/centrale_767/", todayOnly: true },
  { id: "mexico", city: "milano", name: "Mexico", lat: 45.4529, lng: 9.1607, url: "https://movieplayer.it/cinema/mexico_780/", source: "https://movieplayer.it/cinema/mexico_780/", todayOnly: true },
  {
    id: "cinemateca-bogota",
    city: "bogota",
    name: "Cinemateca de Bogotá",
    lat: 4.6107,
    lng: -74.0691,
    url: "https://cinematecadebogota.gov.co/agenda/11",
    source: "https://cinematecadebogota.gov.co/agenda/11",
  },
  {
    id: "cinecolombia-santafe",
    city: "bogota",
    name: "Cine Colombia Santafé",
    lat: 4.7628,
    lng: -74.0463,
    url: "https://www.cinecolombia.com/cartelera/bogota/santa-fe-bogota",
    source: "https://www.cinecolombia.com/cartelera/bogota/santa-fe-bogota",
  },
];

export const cinemasIn = (city: CityId) => CINEMAS.filter((c) => c.city === city);

export const cinemaById = (id: CinemaId): Cinema => {
  const c = CINEMAS.find((x) => x.id === id);
  if (!c) throw new Error(`sala sconosciuta: ${id}`);
  return c;
};
