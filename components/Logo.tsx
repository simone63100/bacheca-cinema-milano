import Link from "next/link";

/** "Bijoux" in Fraunces, sabbia, netto: la "y" si legge (TODO.md, via Pinyon Script). */
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Bijoux, torna alla bacheca">
      Bijoux
    </Link>
  );
}
