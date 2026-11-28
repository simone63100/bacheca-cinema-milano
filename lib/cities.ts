import type { LatLng } from "./geo";
import { distanceKm } from "./geo";

export type CityId = "milano" | "bogota";

export interface City extends LatLng {
  id: CityId;
  name: string;
  /** IANA zone: every time shown or reasoned about in this city uses it. */
  tz: string;
  /** TMDB search language for titles printed by this city's cinemas. */
  tmdbLang: "it-IT" | "es-CO";
  tmdbRegion: "IT" | "CO";
  /** Freshness guard: older than this → banner + one admin alert (daily vs weekly scrape). */
  staleAfterHours: number;
  /**
   * Which title the board shows: "tmdb" = TMDB's localised title (Milano, Italian),
   * "sala" = as printed by the city's cinemas (Bogotá: TMDB has no reliable es-CO titles,
   * and a film shared with Milano would otherwise show in Italian).
   */
  titles: "tmdb" | "sala";
  quartieri: { label: string; lat: number; lng: number }[];
}

export const CITIES: City[] = [
  {
    id: "milano",
    name: "Milano",
    lat: 45.4642,
    lng: 9.19,
    tz: "Europe/Rome",
    tmdbLang: "it-IT",
    tmdbRegion: "IT",
    staleAfterHours: 26,
    titles: "tmdb",
    quartieri: [
      { label: "Duomo", lat: 45.4642, lng: 9.19 },
      { label: "Brera", lat: 45.4719, lng: 9.1879 },
      { label: "Porta Venezia", lat: 45.4744, lng: 9.2052 },
      { label: "Isola", lat: 45.4876, lng: 9.1897 },
      { label: "NoLo", lat: 45.4964, lng: 9.2186 },
      { label: "Città Studi", lat: 45.4783, lng: 9.2275 },
      { label: "Porta Romana", lat: 45.4513, lng: 9.2032 },
      { label: "Navigli", lat: 45.4522, lng: 9.1772 },
      { label: "Porta Genova / Tortona", lat: 45.4535, lng: 9.1665 },
      { label: "Sempione / Arco della Pace", lat: 45.4757, lng: 9.1725 },
      { label: "CityLife / Fiera", lat: 45.4775, lng: 9.1555 },
      { label: "Bicocca / Niguarda", lat: 45.5148, lng: 9.2113 },
      { label: "Lambrate", lat: 45.4846, lng: 9.2398 },
      { label: "Corvetto", lat: 45.4405, lng: 9.2229 },
    ],
  },
  {
    id: "bogota",
    name: "Bogotá",
    lat: 4.6097,
    lng: -74.0817,
    tz: "America/Bogota",
    tmdbLang: "es-CO",
    tmdbRegion: "CO",
    staleAfterHours: 8 * 24, // weekly scrape, on Thursdays
    titles: "sala",
    quartieri: [
      { label: "La Candelaria / Centro", lat: 4.5981, lng: -74.0758 },
      { label: "La Macarena / La Merced", lat: 4.6146, lng: -74.0663 },
      { label: "Teusaquillo", lat: 4.6346, lng: -74.0786 },
      { label: "Chapinero", lat: 4.6486, lng: -74.0628 },
      { label: "Zona G / Quinta Camacho", lat: 4.6587, lng: -74.0565 },
      { label: "Usaquén", lat: 4.6951, lng: -74.0308 },
      { label: "Cedritos", lat: 4.7225, lng: -74.0445 },
      { label: "Toberín / Santafé", lat: 4.7465, lng: -74.0462 },
    ],
  },
];

export const DEFAULT_CITY: CityId = "milano";

export const cityById = (id: string | null | undefined): City => CITIES.find((c) => c.id === id) ?? CITIES.find((c) => c.id === DEFAULT_CITY)!;

/** The city whose centre is within 50 km of a position, or null. */
export function cityNear(p: LatLng): City | null {
  const best = CITIES.map((c) => ({ c, km: distanceKm(p, c) })).sort((a, b) => a.km - b.km)[0];
  return best && best.km <= 50 ? best.c : null;
}

export const isCity = (v: unknown): v is CityId => CITIES.some((c) => c.id === v);
