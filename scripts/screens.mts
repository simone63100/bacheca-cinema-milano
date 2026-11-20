/** pnpm screens [baseUrl] — 390px screenshots of home and scheda, next to refs/bijoux.png. */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://bijoux.ing-albertodimaria.workers.dev";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 45.4642, longitude: 9.19 },
  permissions: ["geolocation"],
  locale: "it-IT",
  timezoneId: "Europe/Rome",
});
const page = await ctx.newPage();
await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/screens/home-390.png" });
await page.getByTestId("cover-active").click();
await page.waitForURL(/\/film\/\d+/);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/screens/scheda-390.png" });
console.log("salvati docs/screens/home-390.png e scheda-390.png da", page.url());
await browser.close();
