import { defineConfig, devices } from "@playwright/test";

// Single source for the preview port — forwarded to the webServer command.
const PORT = Number(process.env.E2E_PORT ?? 4173);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

// Chromium-only by default (and in CI); set PLAYWRIGHT_ALL_BROWSERS=1 locally
// to opt in to Firefox and WebKit runs.
const allBrowsers = !process.env.CI && process.env.PLAYWRIGHT_ALL_BROWSERS === "1";

// Visual comparisons run in their own project so they can opt out of retries:
// a missing committed baseline must fail the run (Playwright writes the
// baseline on the first attempt, so a retry would silently pass against it).
const VISUAL_SPEC = /visual\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],
  // Baselines are CI (Linux) generated, so the platform suffix is omitted.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // Tolerate minor anti-aliasing drift across Chromium releases.
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The PWA service worker would bypass route interception on reloads.
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: VISUAL_SPEC },
    {
      name: "visual",
      use: { ...devices["Desktop Chrome"] },
      testMatch: VISUAL_SPEC,
      retries: 0,
    },
    ...(allBrowsers
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            testIgnore: VISUAL_SPEC,
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            testIgnore: VISUAL_SPEC,
          },
        ]
      : []),
  ],
  // Self-contained: builds the WASM module (when missing) and the production
  // bundle, then serves dist/ with `vite preview`. The generous timeout covers
  // a cold wasm-pack build on first local run.
  webServer: {
    command: "bun run e2e:server",
    env: { E2E_PORT: String(PORT) },
    url: BASE_URL,
    // Opt-in reuse only: a stray server on the port would otherwise serve
    // stale or unrelated content.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
