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
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const port = Number(process.env.E2E_PORT ?? 4321);

/**
 * `astro preview` silently moves to the next free port when its own is taken,
 * which would leave Playwright waiting on a URL nothing will ever answer (and,
 * worse, could let a stale server on that port serve the suite). There is no
 * --strictPort equivalent, so refuse to continue instead.
 */
function assertPortFree() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", (error) => {
      reject(
        error.code === "EADDRINUSE"
          ? new Error(
              `[e2e-build] port ${port} is already in use — stop that server or ` +
                "run with a different E2E_PORT",
            )
          : error,
      );
    });
    probe.once("listening", () => probe.close(() => resolvePort()));
    probe.listen(port, HOST);
  });
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distEntry = resolve(root, "dist", "index.html");
const pagefindIndex = resolve(root, "dist", "pagefind", "pagefind.js");

function run(command) {
  console.log(`[e2e-build] ${command}`);
  execSync(command, { cwd: root, stdio: "inherit" });
}

/** Both paths must leave a servable dist/ behind, index and search index alike. */
function assertBuildArtifacts() {
  if (!existsSync(distEntry)) {
    throw new Error("[e2e-build] dist/index.html is missing");
  }
  if (!existsSync(pagefindIndex)) {
    throw new Error("[e2e-build] dist/pagefind/ is missing — the search suites need it");
  }
}

if (process.env.E2E_SITE_PREBUILT === "1") {
  console.log("[e2e-build] E2E_SITE_PREBUILT=1 — skipping site build");
} else {
  run("bun run build");
}

assertBuildArtifacts();

try {
  await assertPortFree();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
