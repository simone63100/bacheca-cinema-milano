"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PLACE, type Place } from "@/lib/view";

const KEY = "bijoux.place";

/** Position stays in this browser (localStorage); it is never sent to the server. */
export function usePlace() {
  const [place, setPlaceState] = useState<Place>(DEFAULT_PLACE);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);

  const setPlace = useCallback((p: Place) => {
    setPlaceState(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  }, []);

  const locate = useCallback(
    (radiusKm: number) => {
      if (!("geolocation" in navigator)) {
        setDenied(true);
        return;
      }
      setAsking(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAsking(false);
          setDenied(false);
          setPlace({ label: "qui", lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm, precise: true });
        },
        () => {
          setAsking(false);
          setDenied(true);
        },
        { maximumAge: 10 * 60_000, timeout: 10_000 },
      );
    },
    [setPlace],
  );

  useEffect(() => {
    let saved: Place | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw) as Place;
    } catch {}
    if (saved) setPlaceState(saved);
    if (!saved || saved.precise) locate(saved?.radiusKm ?? DEFAULT_PLACE.radiusKm);
  }, [locate]);

  return { place, setPlace, locate, asking, denied };
}
