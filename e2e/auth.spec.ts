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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Il tuo Bijoux");
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Il tuo Bijoux");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-sbagliata");
  await page.locator("form").getByRole("button", { name: "Entra" }).click();
  await expect(page.locator("form .err")).toHaveText("Email o password non corretti.");

  await page.getByLabel("Password").fill(password);
  await page.locator("form").getByRole("button", { name: "Entra" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impostazioni", { timeout: 15_000 });
});

test("la pagina di accesso non scorre e ha i campi giusti", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Continua con Google" })).toBeVisible();
  const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sw).toBeLessThanOrEqual(0);
});
