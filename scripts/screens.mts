/** pnpm screens [baseUrl] — home and panel at 390px and 1280px, tiled into docs/screens/confronto.png. */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://bijoux.ing-albertodimaria.workers.dev";
const browser = await chromium.launch();
for (const [name, viewport] of [
  ["390", { width: 390, height: 844 }],
  ["1280", { width: 1280, height: 800 }],
] as const) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    geolocation: { latitude: 45.4642, longitude: 9.19 },
    permissions: ["geolocation"],
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByTestId("cover-active").waitFor();
  await page.waitForTimeout(1200); // geolocation re-ranks the list
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/screens/home-${name}.png` });
  await page.getByTestId("cover-active").click();
  await page.getByTestId("panel").waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `docs/screens/pannello-${name}.png` });
  await ctx.close();
}
console.log("salvati docs/screens/{home,pannello}-{390,1280}.png");
await browser.close();
