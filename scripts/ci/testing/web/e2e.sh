#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Build the web app's Rust/WASM prerequisites and run the Playwright smoke suite.
#
# Used as the `test-command` of lgtm-ci's reusable-test-e2e-playwright. That
# reusable installs bun dependencies and the Chromium browser, but has no Rust
# stage, so the wasm32 target, wasm-pack, the WASM module, and the production
# bundle are built here. Extra arguments (the reusable appends `--reporter`
# flags) are forwarded to `playwright test`.
set -euo pipefail

# The reusable appends `--reporter=html --reporter=json`, but Playwright's CLI
# keeps only the last `--reporter`, which would drop the HTML report the
# workflow uploads on failure. Collapse repeated flags into one value.
playwright_args=()
reporters=()
for arg in "$@"; do
	case "${arg}" in
	--reporter=*) reporters+=("${arg#--reporter=}") ;;
	*) playwright_args+=("${arg}") ;;
	esac
done
if [[ ${#reporters[@]} -gt 0 ]]; then
	joined="$(
		IFS=,
		echo "${reporters[*]}"
	)"
	playwright_args=("--reporter=${joined}" ${playwright_args[@]+"${playwright_args[@]}"})
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
WEB_DIR="${ROOT}/apps/web"

cd "${WEB_DIR}"

# install-wasm-pack.sh ships Linux release checksums only, so provisioning is
# gated on CI; a local run is expected to already have the toolchain from
# `make setup` (CONTRIBUTING.md).
if [[ "${CI:-}" == "true" ]]; then
	echo "::group::Provision Rust wasm toolchain"
	rustup target add wasm32-unknown-unknown
	"${SCRIPT_DIR}/install-wasm-pack.sh"
	echo "::endgroup::"
elif ! command -v wasm-pack >/dev/null 2>&1; then
	echo "e2e.sh: wasm-pack not found — run 'make setup' first" >&2
	exit 1
fi

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
E2E_WASM_PREBUILT=1 E2E_APP_PREBUILT=1 bunx playwright test \
	${playwright_args[@]+"${playwright_args[@]}"}
