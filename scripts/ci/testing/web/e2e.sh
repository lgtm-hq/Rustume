#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Run the web app Playwright suites (smoke, per-flow E2E, visual, a11y).
#
# Invoked as the `test-command` of lgtm-ci's reusable-test-e2e-playwright,
# which already installed the bun dependencies and the Chromium browser, and
# which appends its own CLI arguments (--project / --grep filters and the
# html+json reporters) — hence the "$@" passthrough on the Playwright call.
#
# What the reusable does not provide, and this script therefore owns: the Rust
# wasm32 toolchain, wasm-pack, the WASM build, and the production bundle build.
# Both bundles are built here rather than inside the Playwright webServer so
# their logs stay visible and the webServer reduces to serving a prebuilt dist/.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
WEB_DIR="${ROOT}/apps/web"

echo "::group::Install Rust wasm32 target and wasm-pack"
rustup target add wasm32-unknown-unknown
"${SCRIPT_DIR}/install-wasm-pack.sh"
echo "::endgroup::"

echo "::group::Build WASM module"
# Unlike the local `bun run build:wasm` (--mode no-install), let wasm-pack
# fetch the matching wasm-bindgen/binaryen binaries from GitHub releases —
# CI runners have no preinstalled wasm-bindgen CLI.
(cd "${ROOT}/bindings/wasm" && wasm-pack build --release --target web --out-dir ../../apps/web/wasm)
echo "::endgroup::"

cd "${WEB_DIR}"

echo "::group::Build app bundle"
E2E_WASM_PREBUILT=1 node scripts/e2e-build.js
echo "::endgroup::"

# Both artifacts were just built above — the webServer only runs vite preview.
status=0
E2E_WASM_PREBUILT=1 E2E_APP_PREBUILT=1 bunx playwright test "$@" || status=$?

# On failure, fold the visual baselines into the uploaded report artifact. When
# a baseline is missing, Playwright writes the freshly rendered (Linux) image
# to e2e/__screenshots__ and fails; the reusable only uploads test-results/, so
# copy them across to keep "commit the baselines from the artifact" workable.
if [[ "${status}" -ne 0 && -d e2e/__screenshots__ ]]; then
	mkdir -p test-results
	cp -R e2e/__screenshots__ test-results/__screenshots__
fi

exit "${status}"
