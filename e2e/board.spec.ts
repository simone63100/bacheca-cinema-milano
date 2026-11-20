import { expect, test } from "@playwright/test";
import { CINEMAS } from "../lib/cinemas";
import { distanceKm } from "../lib/geo";

const HERE = { lat: 45.5148, lng: 9.2113 };

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "scroll orizzontale").toBeLessThanOrEqual(cw);
}

test("visita anonima con geolocalizzazione: solo sale nel raggio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "da qui" })).toBeVisible();
  const halls = page.getByTestId("hall");
  // a day with screenings near Isola: try the next days until one has halls
  const chips = page.locator(".days button");
  for (let i = 0; i < 7 && (await halls.count()) === 0; i++) await chips.nth(i).click();
  expect(await halls.count()).toBeGreaterThan(0);
  const ids = await halls.evaluateAll((els) => els.map((e) => e.getAttribute("data-cinema")!));
  for (const id of ids) {
    const c = CINEMAS.find((x) => x.id === id)!;
    expect(distanceKm(HERE, c), `${c.name} fuori dai 5 km`).toBeLessThanOrEqual(5);
  }
  const outside = CINEMAS.filter((c) => distanceKm(HERE, c) > 5).map((c) => c.id);
  expect(outside.length).toBeGreaterThan(0);
  for (const id of outside) expect(ids).not.toContain(id);
  await noHorizontalScroll(page);
});

test("raggio più stretto toglie le sale lontane", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "da qui" }).click();
  await page.getByLabel("Raggio in km").selectOption("3");
  await expect(page.locator(".loc")).toContainText("entro 3 km");
  const ids = await page.getByTestId("hall").evaluateAll((els) => els.map((e) => e.getAttribute("data-cinema")!));
  for (const id of ids) expect(distanceKm(HERE, CINEMAS.find((x) => x.id === id)!)).toBeLessThanOrEqual(3);
});

test("clic sulla copertina → scheda con orari raggruppati per sala", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "da qui" })).toBeVisible(); // list re-ranks after geolocation
  const cover = page.getByTestId("cover-active");
  await expect(cover).toBeVisible();
  const title = (await page.locator("h2.t").innerText()).trim();
  await cover.click();
  await expect(page).toHaveURL(/\/film\/\d+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const salas = page.getByTestId("sala");
  expect(await salas.count()).toBeGreaterThan(0);
  await expect(salas.first().locator(".sl").first()).toContainText(/\d{2}:\d{2}/);
  await expect(page.getByRole("link", { name: "Biglietti" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("vista elenco per sala e per giorno", async ({ page }) => {
  await page.goto("/");
  const chips = page.locator(".days button");
  await expect(chips).toHaveCount(7);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  const halls = page.getByTestId("hall");
  if ((await halls.count()) > 0) {
    await expect(halls.first().locator(".cn b")).not.toBeEmpty();
    await expect(halls.first().locator(".sl").first()).toContainText(/\d{2}:\d{2}/);
  }
  await noHorizontalScroll(page);
});
