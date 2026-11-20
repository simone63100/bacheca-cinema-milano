import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilmSheet } from "@/components/FilmSheet";
import { loadFilm } from "@/lib/board";
import { CINEMAS } from "@/lib/cinemas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const film = await loadFilm(Number((await params).id));
  return { title: film ? `${film.title} · Bijoux` : "Bijoux" };
}

export default async function FilmPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const film = await loadFilm(id);
  if (!film) notFound();
  return <FilmSheet film={film} cinemas={CINEMAS} />;
}
