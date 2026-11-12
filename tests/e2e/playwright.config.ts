import { defineConfig } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "output/playwright/report", open: "never" }],
  ],
  outputDir: "../../output/playwright/results",
  use: {
    baseURL: "http://127.0.0.1:3115",
    browserName: "chromium",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: "**/mobile.spec.ts" },
    {
      name: "mobile-chromium",
      testMatch: "**/mobile.spec.ts",
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node --import tsx scripts/e2e-server.mjs",
    cwd: path.resolve(__dirname, "../.."),
    url: "http://127.0.0.1:3115/api/health/ready",
    reuseExistingServer: false,
    timeout: 120000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 15000 },
  },
});
