#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run the web app Playwright suites (smoke, per-flow E2E, visual, a11y).
# Pre-builds the WASM module so the Playwright webServer only needs a fast
# Vite build before serving the app.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
WEB_DIR="${ROOT}/apps/web"

cd "${WEB_DIR}"

bun install --frozen-lockfile

echo "::group::Install Playwright Chromium"
bunx playwright install --with-deps chromium
echo "::endgroup::"

echo "::group::Build WASM module"
# Unlike the local `bun run build:wasm` (--mode no-install), let wasm-pack
# fetch the matching wasm-bindgen/binaryen binaries from GitHub releases —
# CI runners have no preinstalled wasm-bindgen CLI.
(cd "${ROOT}/bindings/wasm" && wasm-pack build --release --target web --out-dir ../../apps/web/wasm)
echo "::endgroup::"

echo "::group::Build app bundle"
# Build outside the Playwright webServer so build logs stay visible and the
# webServer step reduces to serving the prebuilt dist/.
E2E_WASM_PREBUILT=1 node scripts/e2e-build.js
echo "::endgroup::"

# Both artifacts were just built above — the webServer only runs vite preview.
E2E_WASM_PREBUILT=1 E2E_APP_PREBUILT=1 bunx playwright test
