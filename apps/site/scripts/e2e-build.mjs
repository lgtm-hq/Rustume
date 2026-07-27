// SPDX-License-Identifier: AGPL-3.0-only
// Build the static site so the Playwright webServer can serve a self-contained
// copy via `astro preview`.
//
// The site is rebuilt by default so tests never run against stale sources; set
// E2E_SITE_PREBUILT=1 (as CI does after its own build step) to reuse a
// verified build already in apps/site/dist/. The Pagefind index the search
// dropdown loads is produced by `bun run build`, so a prebuilt dist must come
// from that same script — hence the index check alongside the entry check.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = resolve(root, "dist", "index.html");
const pagefindIndex = resolve(root, "dist", "pagefind", "pagefind.js");

function run(command) {
  console.log(`[e2e-build] ${command}`);
  execSync(command, { cwd: root, stdio: "inherit" });
}

if (process.env.E2E_SITE_PREBUILT === "1") {
  if (!existsSync(distEntry)) {
    throw new Error("[e2e-build] E2E_SITE_PREBUILT=1 but dist/ is missing");
  }
  if (!existsSync(pagefindIndex)) {
    throw new Error("[e2e-build] E2E_SITE_PREBUILT=1 but dist/pagefind/ is missing");
  }
  console.log("[e2e-build] E2E_SITE_PREBUILT=1 — skipping site build");
} else {
  run("bun run build");
}
