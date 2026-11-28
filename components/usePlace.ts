"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cityById, cityNear, type City, type CityId } from "@/lib/cities";
import { NEAR_ME_KM, WHOLE_CITY_KM, defaultPlace, type Place } from "@/lib/view";

const key = (city: CityId) => `bijoux.place.${city}`;

/** Remembers the chosen city for the server (it picks which board to load). */
export function rememberCity(id: CityId) {
  document.cookie = `bijoux.citta=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Position stays in this browser (localStorage, per city); it is never sent to the server.
 * Default: the whole city. With geolocation: the nearest city within 50 km and "vicino a me";
 * if that city is not the one on screen, switch to it.
 */
export function usePlace(city: City) {
  const router = useRouter();
  const [place, setPlaceState] = useState<Place>(() => defaultPlace(city));
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);
  const [outside, setOutside] = useState(false);

  const setPlace = useCallback(
    (p: Place) => {
      setPlaceState(p);
      try {
        localStorage.setItem(key(city.id), JSON.stringify(p));
      } catch {}
    },
    [city.id],
  );

  const go = useCallback(
    (id: CityId) => {
      rememberCity(id);
      router.replace(`/?citta=${id}`);
    },
    [router],
  );

  /** Picked by hand: that city as a whole, without asking the position again (it would bounce back). */
  const switchCity = useCallback(
    (id: CityId) => {
      try {
        const saved = JSON.parse(localStorage.getItem(key(id)) ?? "null") as Place | null;
        if (!saved || saved.precise) localStorage.setItem(key(id), JSON.stringify(defaultPlace(cityById(id))));
      } catch {}
      go(id);
    },
    [go],
  );

  const locate = useCallback(
    (wanted = NEAR_ME_KM) => {
      // "tutta la città" is a radius around the centre, not around me: near me starts at 5 km
      const radiusKm = wanted >= WHOLE_CITY_KM ? NEAR_ME_KM : wanted;
      if (!("geolocation" in navigator)) {
        setDenied(true);
        return;
      }
      setAsking(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAsking(false);
          setDenied(false);
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const near = cityNear(here);
          if (near && near.id !== city.id) {
            try {
              localStorage.setItem(key(near.id), JSON.stringify({ label: "Vicino a me", ...here, radiusKm, precise: true }));
            } catch {}
            go(near.id);
            return;
          }
          if (near) setPlace({ label: "Vicino a me", ...here, radiusKm, precise: true });
          else {
            setOutside(true);
            setPlace(defaultPlace(city));
          }
        },
        () => {
          setAsking(false);
          setDenied(true);
        },
        { maximumAge: 10 * 60_000, timeout: 10_000 },
      );
    },
    [city, setPlace, go],
  );

  useEffect(() => {
    let saved: Place | null = null;
    try {
      const raw = localStorage.getItem(key(city.id));
      if (raw) saved = JSON.parse(raw) as Place;
    } catch {}
    setPlaceState(saved ?? defaultPlace(city));
    rememberCity(city.id);
    if (!saved || saved.precise) locate(saved?.radiusKm ?? NEAR_ME_KM);
  }, [city, locate]);

  return { place, setPlace, locate, asking, denied, outside, switchCity };
}
