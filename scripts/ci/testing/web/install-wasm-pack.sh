#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install a pinned wasm-pack release binary (Linux x86_64) for CI.
# Verifies the archive against a pinned SHA-256 before installing.
set -euo pipefail

WASM_PACK_VERSION="${WASM_PACK_VERSION:-0.15.0}"
WASM_PACK_SHA256="${WASM_PACK_SHA256:-c09f971ecaed9a2efc80fdcea7a00ef6b53c7fadc8c57d1f61b53a6aa66b668a}"
TARGET_TRIPLE="x86_64-unknown-linux-musl"

if command -v wasm-pack >/dev/null 2>&1; then
	echo "wasm-pack already installed: $(wasm-pack --version)"
	exit 0
fi

archive="wasm-pack-v${WASM_PACK_VERSION}-${TARGET_TRIPLE}.tar.gz"
url="https://github.com/rustwasm/wasm-pack/releases/download/v${WASM_PACK_VERSION}/${archive}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

echo "Downloading ${url}"
curl --fail --silent --show-error --location --output "${tmp_dir}/${archive}" "${url}"

echo "${WASM_PACK_SHA256}  ${tmp_dir}/${archive}" | sha256sum --check --quiet

tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
install -m 0755 \
	"${tmp_dir}/wasm-pack-v${WASM_PACK_VERSION}-${TARGET_TRIPLE}/wasm-pack" \
	"${HOME}/.cargo/bin/wasm-pack"

echo "Installed $(wasm-pack --version)"
