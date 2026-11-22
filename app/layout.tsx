import type { Metadata, Viewport } from "next";
import { Fraunces, Jost } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Bijoux · cinema d'essai a Milano",
  description: "Cosa passa nelle sale d'essai di Milano vicino a te, in un posto solo.",
};

export const viewport: Viewport = { themeColor: "#0d0c0b", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${fraunces.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
