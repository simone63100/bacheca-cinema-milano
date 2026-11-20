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
  | "mexico";

export interface Cinema {
  id: CinemaId;
  name: string;
  lat: number;
  lng: number;
  /** Public page of the cinema (shown to users). */
  url: string;
  /** Page the scraper reads. */
  source: string;
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
}
