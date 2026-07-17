#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run the web app Playwright smoke suite.
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

# The module was just built above — tell the webServer build to reuse it.
E2E_WASM_PREBUILT=1 bunx playwright test
