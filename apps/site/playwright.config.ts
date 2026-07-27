import { defineConfig, devices } from "@playwright/test";

// Single source for the preview port — forwarded to the webServer command.
// Deliberately not apps/web's 4173: both suites must be runnable at once.
const PORT = Number(process.env.E2E_PORT ?? 4321);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

// Chromium-only by default (and in CI); set PLAYWRIGHT_ALL_BROWSERS=1 locally
// to opt in to Firefox and WebKit runs.
const allBrowsers = !process.env.CI && process.env.PLAYWRIGHT_ALL_BROWSERS === "1";

/**
 * `reducedMotion` states the intent of these scans — they describe the steady
 * state of a surface, not a frame of its entrance animation. It is not what
 * makes them deterministic: Rustume#618 measured that `matchMedia` still
 * reports `no-preference` under Playwright 1.61 with `devices["Desktop
 * Chrome"]`, so no `prefers-reduced-motion` rule actually engages. What keeps
 * the scans stable is that page objects wait for each surface's own end state
 * (`toHaveCSS("opacity", "1")` on the search dialog, the theme stylesheet's
 * custom properties for a theme swap) instead of for a duration.
 */
const REDUCED_MOTION = { contextOptions: { reducedMotion: "reduce" } } as const;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "a11y", use: { ...devices["Desktop Chrome"], ...REDUCED_MOTION } },
    ...(allBrowsers
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"], ...REDUCED_MOTION } },
          { name: "webkit", use: { ...devices["Desktop Safari"], ...REDUCED_MOTION } },
        ]
      : []),
  ],
  // Self-contained: builds the static site (including the Pagefind index the
  // search dropdown loads) and serves dist/ with `astro preview`. The generous
  // timeout covers a cold first build.
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
