/**
 * Pre-build: copy shared assets into public/.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(__dirname, "..");
const repoRoot = resolve(siteRoot, "..", "..");
const publicAssets = join(siteRoot, "public", "assets");
const publicDir = join(siteRoot, "public");

mkdirSync(publicAssets, { recursive: true });

const logo = join(repoRoot, "docs", "rustume.png");
if (existsSync(logo)) {
  cpSync(logo, join(publicAssets, "rustume.png"));
  console.log("Copied rustume.png");
}

const favicon = join(repoRoot, "apps", "web", "public", "favicon.svg");
if (existsSync(favicon)) {
  cpSync(favicon, join(publicDir, "favicon.svg"));
  console.log("Copied favicon.svg");
}

const legalDir = join(publicDir, "legal");
mkdirSync(legalDir, { recursive: true });
for (const name of ["LICENSE", "NOTICE", "THIRD_PARTY_NOTICES"]) {
  const src = join(repoRoot, name);
  if (existsSync(src)) {
    cpSync(src, join(legalDir, name));
    console.log(`Copied ${name}`);
  } else {
    throw new Error(`Missing required legal file: ${name}`);
  }
}

const turboCssRoot = join(
  siteRoot,
  "node_modules",
  "@lgtm-hq",
  "turbo-themes",
  "packages",
  "css",
  "dist",
);

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

if (existsSync(turboCssRoot)) {
  copyDir(turboCssRoot, join(publicAssets, "css"));
  console.log("Copied turbo-themes CSS");
} else {
  throw new Error("turbo-themes CSS not found — run bun install in apps/site first");
}
