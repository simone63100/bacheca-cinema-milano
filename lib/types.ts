export type CinemaId =
  | "palestrina"
  | "arlecchino"
  | "mic"
  | "godard"
  | "anteo"
  | "citylife"
  | "colosseo"
  | "beltrade"
  | "arcobaleno"
  | "cinemino"
  | "ariosto"
  | "centrale"
  | "mexico"
  | "cinemateca-bogota"
  | "cinecolombia-santafe";

export interface Cinema {
  id: CinemaId;
  city: import("./cities").CityId;
  name: string;
  lat: number;
  lng: number;
  /** Public page of the cinema (shown to users). */
  url: string;
  /** Page the scraper reads. */
  source: string;
  /** Source lists only today's screenings: its "last screening" says nothing about the run. */
  todayOnly?: boolean;
}

/** One screening as read from a cinema source, before TMDB matching. */
export interface Screening {
  cinemaId: CinemaId;
  /** Title as printed by the cinema, cleaned of V.O./tags. */
  title: string;
  /** UTC ISO instant. */
  startsAt: string;
  vo: boolean;
  /** Restoration, preview, guests in the room, festival event. */
  special: boolean;
  /** Ticket or detail page for this screening. */
  url: string;
  director?: string;
  year?: number;
  originalTitle?: string;
  /** Poster published by the cinema, used when TMDB has none. */
  poster?: string;
}
