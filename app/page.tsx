import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BoardView } from "@/components/BoardView";
import { loadBoard } from "@/lib/board";
import { DEFAULT_CITY, cityById, isCity, type CityId } from "@/lib/cities";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ citta?: string }> };

/** City: ?citta= wins, then the cookie the board sets, then Milano. */
async function pickCity(searchParams: Props["searchParams"]): Promise<CityId> {
  const { citta } = await searchParams;
  const saved = (await cookies()).get("bijoux.citta")?.value;
  return isCity(citta) ? citta : isCity(saved) ? saved : DEFAULT_CITY;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const city = cityById(await pickCity(searchParams));
  return {
    title: `Bijoux · cinema d'essai a ${city.name}`,
    description: `Cosa passa nelle sale d'essai di ${city.name} vicino a te, in un posto solo.`,
  };
}

export default async function Home({ searchParams }: Props) {
  const city = await pickCity(searchParams);
  const board = await loadBoard(city);
  return <BoardView key={city} board={board} />;
}
