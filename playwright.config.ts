import { defineConfig, devices } from "@playwright/test";

// UI tests drive the browser preview, which runs the real frontend with
// in-memory data. They use their own port so a running `npm run dev:app` or
// another checkout is never tested by mistake. Native window features need
// `npm run dev:app`.
export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:1430",
    colorScheme: "dark",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 1430",
    url: "http://localhost:1430",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
