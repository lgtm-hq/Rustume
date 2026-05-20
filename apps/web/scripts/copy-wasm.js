import { cpSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "wasm");
const dest = resolve(root, "dist", "wasm");

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
} else {
  console.warn("warn: wasm/ directory not found — skipping copy (run `make setup` to build WASM)");
}
