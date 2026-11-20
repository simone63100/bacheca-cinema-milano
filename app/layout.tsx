import type { Metadata, Viewport } from "next";
import { Fraunces, Jost, Pinyon_Script } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", weight: ["400", "500", "600"] });
const pinyon = Pinyon_Script({ subsets: ["latin"], variable: "--font-pinyon", weight: "400" });

export const metadata: Metadata = {
  title: "Bijoux · cinema d'essai a Milano",
  description: "Cosa passa nelle sale d'essai di Milano vicino a te, in un posto solo.",
};

export const viewport: Viewport = { themeColor: "#f3c9d1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${fraunces.variable} ${jost.variable} ${pinyon.variable}`}>
      <body>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
          <defs>
            <filter id="thread">
              <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" />
            </filter>
          </defs>
        </svg>
        <div className="frame" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
