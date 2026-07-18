#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install a pinned wasm-pack release binary (Linux) for CI.
# Verifies the archive against a pinned SHA-256 before installing.
set -euo pipefail

DEFAULT_WASM_PACK_VERSION="0.15.0"
WASM_PACK_VERSION="${WASM_PACK_VERSION:-${DEFAULT_WASM_PACK_VERSION}}"

# The bundled checksums only cover the default version — a version override
# must bring its own checksum or the verification failure would be opaque.
if [[ "${WASM_PACK_VERSION}" != "${DEFAULT_WASM_PACK_VERSION}" && -z "${WASM_PACK_SHA256:-}" ]]; then
	echo "install-wasm-pack.sh: WASM_PACK_VERSION=${WASM_PACK_VERSION} overrides the default" \
		"(${DEFAULT_WASM_PACK_VERSION}) — set WASM_PACK_SHA256 for that release too" >&2
	exit 1
fi

arch="$(uname -m)"
case "${arch}" in
x86_64)
	target_triple="x86_64-unknown-linux-musl"
	default_sha256="c09f971ecaed9a2efc80fdcea7a00ef6b53c7fadc8c57d1f61b53a6aa66b668a"
	;;
aarch64 | arm64)
	target_triple="aarch64-unknown-linux-musl"
	default_sha256="e17ef0806381c3a0acb9c9ddad643a49facaa5a2ecf657a421d4d8f3357a24b7"
	;;
*)
	echo "install-wasm-pack.sh: unsupported architecture '${arch}'" >&2
	exit 1
	;;
esac
WASM_PACK_SHA256="${WASM_PACK_SHA256:-${default_sha256}}"

# Only trust a preinstalled binary when it matches the pinned version;
# anything else is replaced by the checksum-verified release below.
if command -v wasm-pack >/dev/null 2>&1; then
	installed_version="$(wasm-pack --version | awk '{print $2}')"
	if [[ "${installed_version}" == "${WASM_PACK_VERSION}" ]]; then
		echo "wasm-pack ${installed_version} already installed — matches pin"
		exit 0
	fi
	echo "wasm-pack ${installed_version} found but pin is ${WASM_PACK_VERSION} — reinstalling"
fi

archive="wasm-pack-v${WASM_PACK_VERSION}-${target_triple}.tar.gz"
url="https://github.com/rustwasm/wasm-pack/releases/download/v${WASM_PACK_VERSION}/${archive}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

echo "Downloading ${url}"
curl --fail --silent --show-error --location --output "${tmp_dir}/${archive}" "${url}"

echo "${WASM_PACK_SHA256}  ${tmp_dir}/${archive}" | sha256sum --check --quiet

tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
install -m 0755 \
	"${tmp_dir}/wasm-pack-v${WASM_PACK_VERSION}-${target_triple}/wasm-pack" \
	"${HOME}/.cargo/bin/wasm-pack"

echo "Installed $(wasm-pack --version)"
