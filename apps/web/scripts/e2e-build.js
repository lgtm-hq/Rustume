// Build the production bundle (and the WASM module when missing) so the
// Playwright webServer can serve a self-contained app via `vite preview`.
//
// The WASM build is skipped when apps/web/wasm/ already contains a build
// (local `make setup` output or a CI pre-build step) to keep e2e runs fast.
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

if (existsSync(wasmEntry)) {
  console.log("[e2e-build] wasm/ already built — skipping WASM build");
} else {
  run("bun run build:wasm");
}

run("bun run build");
