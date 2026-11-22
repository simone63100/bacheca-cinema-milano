import { redirect } from "next/navigation";

/** Old and mailed links: the scheda now opens as a panel on the home, at /?film=<id>. */
export default async function FilmRedirect({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  redirect(Number.isInteger(id) ? `/?film=${id}` : "/");
}
