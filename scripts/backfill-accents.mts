/** pnpm accents — one-off/backfill of the poster glow colour (the daily run does it too). */
import { fillAccents } from "@/lib/pipeline";
console.log(`colori calcolati: ${await fillAccents(1000)}`);
