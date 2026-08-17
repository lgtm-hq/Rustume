#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install a pinned cargo-binstall release binary (Linux musl) for Docker/CI.
# Verifies the archive against a pinned SHA-256 before installing.
set -euo pipefail

DEFAULT_BINSTALL_VERSION="1.21.1"
BINSTALL_VERSION="${BINSTALL_VERSION:-${DEFAULT_BINSTALL_VERSION}}"

# The bundled checksums only cover the default version — a version override
# must bring its own checksum or the verification failure would be opaque.
if [[ "${BINSTALL_VERSION}" != "${DEFAULT_BINSTALL_VERSION}" && -z "${BINSTALL_SHA256:-}" ]]; then
	echo "install-cargo-binstall.sh: BINSTALL_VERSION=${BINSTALL_VERSION} overrides the default" \
		"(${DEFAULT_BINSTALL_VERSION}) — set BINSTALL_SHA256 for that release too" >&2
	exit 1
fi

# Docker BuildKit sets TARGETARCH (amd64|arm64); local/CI callers use uname.
arch="${TARGETARCH:-$(uname -m)}"
case "${arch}" in
amd64 | x86_64)
	target_triple="x86_64-unknown-linux-musl"
	default_sha256="630c8f8803a686aa6779497f0f0fb51d49822fb5fc3c514d8ced33b34e338e6e"
	;;
arm64 | aarch64)
	target_triple="aarch64-unknown-linux-musl"
	default_sha256="1dc2979f3c83aade9a1b4344589d14fafa63459b759222528d11419f5cca9cc2"
	;;
*)
	echo "install-cargo-binstall.sh: unsupported architecture '${arch}'" >&2
	exit 1
	;;
esac
BINSTALL_SHA256="${BINSTALL_SHA256:-${default_sha256}}"
install_dir="${CARGO_HOME:-${HOME}/.cargo}/bin"

if command -v cargo-binstall >/dev/null 2>&1; then
	installed_version="$(cargo-binstall --version | awk '{print $2}')"
	if [[ "${installed_version}" == "${BINSTALL_VERSION}" ]]; then
		echo "cargo-binstall ${installed_version} already installed — matches pin"
		exit 0
	fi
	echo "cargo-binstall ${installed_version} found but pin is ${BINSTALL_VERSION} — reinstalling"
fi

archive="cargo-binstall-${target_triple}.tgz"
url="https://github.com/cargo-bins/cargo-binstall/releases/download/v${BINSTALL_VERSION}/${archive}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

echo "Downloading ${url}"
curl --fail --silent --show-error --location --output "${tmp_dir}/${archive}" "${url}"

echo "${BINSTALL_SHA256}  ${tmp_dir}/${archive}" | sha256sum -c -

tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"
mkdir -p "${install_dir}"
install -m 0755 "${tmp_dir}/cargo-binstall" "${install_dir}/cargo-binstall"

echo "Installed $("${install_dir}/cargo-binstall" --version)"
