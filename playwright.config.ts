import { defineConfig, devices } from "@playwright/test";

const PORT = 3027;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    geolocation: { latitude: 45.5148, longitude: 9.2113 }, // Bicocca: diverse sale oltre i 5 km
    permissions: ["geolocation"],
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  },
  projects: [
    { name: "mobile-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: false, hasTouch: true } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm next dev --port ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 180_000 },
});
