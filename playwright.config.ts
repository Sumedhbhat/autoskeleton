import { defineConfig } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: CI,
  // One retry in CI so a slow runner shows up as "flaky" in the report instead
  // of failing the PR; real failures still fail twice.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    channel: CI ? undefined : "chrome",
    viewport: { width: 1280, height: 900 },
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx vite --config demo/vite.config.ts --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !CI,
  },
});
