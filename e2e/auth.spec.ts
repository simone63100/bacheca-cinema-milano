import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * Email + password on Neon Auth, against the real auth server, on localhost only.
 * Test users live on the @bijoux.test domain and are deleted at the end.
 */
const dbUrl =
  process.env.DATABASE_URL ?? readFileSync(".env.local", "utf8").match(/^DATABASE_URL="?([^"\n]+)/m)?.[1];

test.describe.configure({ mode: "serial" });
test.skip(!!process.env.E2E_BASE_URL, "crea utenti veri: solo in locale");

const email = `e2e-${Date.now()}@bijoux.test`;
const password = `prova-${Math.random().toString(36).slice(2, 10)}`;

test.afterAll(async () => {
  if (!dbUrl) return;
  const sql = neon(dbUrl);
  await sql.query(`DELETE FROM users WHERE email LIKE '%@bijoux.test'`);
  await sql.query(`DELETE FROM neon_auth."user" WHERE email LIKE '%@bijoux.test'`);
});

test("crea account con email e password, esci, rientra", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account Bijoux");
  await page.getByRole("button", { name: "Crea account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Crea account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impostazioni", { timeout: 15_000 });
  await expect(page.getByText(email)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impostazioni"); // session survives reload

  await page.getByRole("button", { name: "Esci" }).click();
  await page.waitForURL(/\/$/);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Account Bijoux");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.locator("form").getByRole("button", { name: "Entra" }).click();
  await expect(page.locator("form .err")).toHaveText("Email o password non corretti.");

  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Entra" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impostazioni", { timeout: 15_000 });
});

test("impostazioni: ogni passo conferma e la lista di stato si aggiorna", async ({ page }) => {
  await page.goto("/account");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Entra" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impostazioni", { timeout: 15_000 });
  await page.waitForLoadState("networkidle"); // hydrated before interacting
  const steps = page.getByRole("list", { name: "Stato" });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps).toContainText("Non ancora");

  // a username that does not exist is refused, not saved
  await page.getByLabel("Nome del tuo profilo Letterboxd").fill("nobjx9e2ezz");
  await page.getByRole("button", { name: "Collega" }).click();
  await expect(page.locator(".err").first()).toContainText("non esiste un profilo", { timeout: 20_000 });

  // the place saves on change, with a visible confirmation
  await page.getByLabel("Quartiere").selectOption("Isola");
  await expect(page.locator("section[aria-labelledby=pos-h] .ok")).toHaveText("Salvato.", { timeout: 30_000 });

  // the ratings file uploads as soon as it is chosen; its type is read from the columns
  await page.locator("#csv").setInputFiles({
    name: "ratings.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Date,Name,Year,Letterboxd URI,Rating\n2026-01-02,Blow-Up,1966,https://boxd.it/x,5\n2026-01-03,Mustang,2015,https://boxd.it/y,4\n"),
  });
  await expect(page.locator("section[aria-labelledby=csv-h] .ok")).toHaveText("2 voti importati da ratings.csv.", { timeout: 30_000 });

  await page.reload();
  await expect(steps).toContainText("Isola, entro 5 km");
  await expect(steps).toContainText("2 voti");
});

test("la pagina di accesso non scorre e ha i campi giusti", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Continua con Google" })).toBeVisible();
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sw).toBeLessThanOrEqual(0);
});
