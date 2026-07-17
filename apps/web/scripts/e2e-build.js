// Build the WASM module and the production bundle so the Playwright
// webServer can serve a self-contained app via `vite preview`.
//
// The WASM module is rebuilt by default so tests never run against stale
// sources; set E2E_WASM_PREBUILT=1 (as CI does after its own build step)
// to skip the rebuild when a verified build is already in apps/web/wasm/.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const wasmEntry = resolve(root, "wasm", "rustume_wasm.js");

function run(command) {
  console.log(`[e2e-build] ${command}`);
  execSync(command, { cwd: root, stdio: "inherit" });
}

if (process.env.E2E_WASM_PREBUILT === "1") {
  if (!existsSync(wasmEntry)) {
    throw new Error("[e2e-build] E2E_WASM_PREBUILT=1 but wasm/ is missing");
  }
  console.log("[e2e-build] E2E_WASM_PREBUILT=1 — skipping WASM build");
} else {
  run("bun run build:wasm");
}

if (process.env.E2E_APP_PREBUILT === "1") {
  if (!existsSync(resolve(root, "dist", "index.html"))) {
    throw new Error("[e2e-build] E2E_APP_PREBUILT=1 but dist/ is missing");
  }
  console.log("[e2e-build] E2E_APP_PREBUILT=1 — skipping app build");
} else {
  run("bun run build");
}
