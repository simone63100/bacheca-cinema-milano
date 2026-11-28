import { expect, test, type Page } from "@playwright/test";
import { CINEMAS } from "../lib/cinemas";
import { distanceKm } from "../lib/geo";

const HERE = { lat: 45.5148, lng: 9.2113 }; // Bicocca: several cinemas beyond 5 km

async function noPageScroll(page: Page) {
  const m = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(m.sh, "scroll verticale della pagina").toBeLessThanOrEqual(m.ih);
  expect(m.sw, "scroll orizzontale della pagina").toBeLessThanOrEqual(m.cw);
}

async function ready(page: Page) {
  await page.goto("/");
  // the list re-ranks once geolocation lands (stored locally as a precise place)
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bijoux.place.milano") ?? "{}").precise === true);
  await expect(page.getByTestId("cover-active")).toBeVisible();
}

test("una sola schermata: nessuno scroll della pagina", async ({ page }) => {
  await ready(page);
  await noPageScroll(page);
});

test("per sala: solo le sale nel raggio, e il raggio più stretto le riduce", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Per sala" }).click();
  const ids = async () =>
    page.locator("[data-hall]").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-hall")!));
  const within5 = await ids();
  expect(within5.length).toBeGreaterThan(0);
  for (const id of within5) expect(distanceKm(HERE, CINEMAS.find((c) => c.id === id)!)).toBeLessThanOrEqual(5);
  expect(CINEMAS.filter((c) => distanceKm(HERE, c) > 5).length).toBeGreaterThan(0);
  await noPageScroll(page);

  await page.getByRole("button", { name: /Impostazioni/ }).click();
  await page.getByLabel("Quanto lontano").selectOption("3");
  await page.getByRole("button", { name: "Chiudi le impostazioni" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  for (const id of await ids()) expect(distanceKm(HERE, CINEMAS.find((c) => c.id === id)!)).toBeLessThanOrEqual(3);
});

test("clic sulla locandina → pannello con cinema e orari nella stessa pagina", async ({ page }) => {
  await ready(page);
  const title = (await page.locator(".info h2").innerText()).trim();
  await page.getByTestId("cover-active").click();
  const panel = page.getByTestId("panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText(title);
  await expect(page).toHaveURL(/\/\?film=\d+$/); // same page, panel state in the query
  const rows = panel.getByTestId("row");
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.first()).toContainText(/\d{2}:\d{2}/);
  await expect(rows.first().getByRole("link", { name: "Biglietti" })).toBeVisible();
  await expect(rows.first().getByRole("link", { name: /calendario/ })).toBeVisible();
  await noPageScroll(page);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test("un link /film/<id> (mail FOMO) apre il pannello", async ({ page }) => {
  await ready(page);
  await page.getByTestId("cover-active").click();
  const id = new URL(page.url()).searchParams.get("film");
  await page.goto(`/film/${id}`);
  await expect(page).toHaveURL(new RegExp(`\\?film=${id}$`));
  await expect(page.getByTestId("panel")).toBeVisible();
});

test("l'alone cambia colore passando da un film all'altro", async ({ page }) => {
  await ready(page);
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    seen.add(await page.locator(".ipod").evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim()));
    await page.keyboard.press("ArrowRight");
  }
  expect(seen.size).toBeGreaterThan(1);
});

test.describe("a Bogotá", () => {
  const SANTAFE_AREA = { latitude: 4.7465, longitude: -74.0462 }; // Toberín, near Santafé
  test.use({ geolocation: SANTAFE_AREA, timezoneId: "America/Bogota" });

  test("la posizione sceglie la città: Bogotá, vicino a me, una sola schermata", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/citta=bogota/, { timeout: 20_000 });
    await expect(page).toHaveTitle(/Bogotá/);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("bijoux.place.bogota") ?? "{}").radiusKm === 5);
    await expect(page.getByTestId("cover-active")).toBeVisible();
    await noPageScroll(page);

    await page.getByRole("button", { name: "Per sala" }).click();
    const halls = await page.locator("[data-hall]").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-hall")));
    expect(halls).toEqual(["cinecolombia-santafe"]); // the Cinemateca is downtown, ~17 km
    await noPageScroll(page);

    await page.getByRole("button", { name: /Impostazioni/ }).click();
    await expect(page.getByLabel("Città")).toHaveValue("bogota");
    await page.getByLabel("Quanto lontano").selectOption("40");
    await page.getByRole("button", { name: "Chiudi le impostazioni" }).click();
    await expect(page.locator("[data-hall]")).toHaveCount(2);
  });

  test("dalle impostazioni si torna a Milano", async ({ page }) => {
    await page.goto("/?citta=bogota");
    await page.getByRole("button", { name: /Impostazioni/ }).click();
    await page.getByLabel("Città").selectOption("milano");
    await expect(page).toHaveURL(/citta=milano/);
    await expect(page).toHaveTitle(/Milano/);
  });
});
