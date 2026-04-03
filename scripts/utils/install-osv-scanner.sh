#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# install-osv-scanner.sh — Download and verify osv-scanner binary.
#
# Usage:
#   scripts/utils/install-osv-scanner.sh [version]
#
# Resolves version as: $1 > $OSV_VERSION env var > 2.3.5 (hardcoded default).
# Resolves install dir as: $INSTALL_DIR env var > /usr/local/bin > ~/.local/bin.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=utils.sh disable=SC1091
source "$SCRIPT_DIR/utils.sh"

OSV_VERSION="${1:-${OSV_VERSION:-2.3.5}}"

# Detect platform
ARCH=$(uname -m)
case "$ARCH" in
x86_64) PLATFORM="linux_amd64" ;;
aarch64 | arm64) PLATFORM="linux_arm64" ;;
*)
	log_error "Unsupported architecture: $ARCH"
	exit 1
	;;
esac
BASE_URL="https://github.com/google/osv-scanner/releases/download/v${OSV_VERSION}"
BINARY_URL="${BASE_URL}/osv-scanner_${PLATFORM}"
CHECKSUMS_URL="${BASE_URL}/osv-scanner_SHA256SUMS"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
if [[ ! -w "$INSTALL_DIR" ]]; then
	INSTALL_DIR="${HOME}/.local/bin"
	mkdir -p "$INSTALL_DIR"
fi
TMPDIR=$(create_temp_dir)

log_info "Installing osv-scanner v${OSV_VERSION}..."

# Download binary and checksums
curl -fsSL "$BINARY_URL" -o "${TMPDIR}/osv-scanner"
curl -fsSL "$CHECKSUMS_URL" -o "${TMPDIR}/SHA256SUMS"

# Verify checksum
EXPECTED=$(grep "osv-scanner_${PLATFORM}" "${TMPDIR}/SHA256SUMS" | awk '{print $1}')
ACTUAL=$(sha256sum "${TMPDIR}/osv-scanner" | awk '{print $1}')

if [[ "$EXPECTED" != "$ACTUAL" ]]; then
	log_error "SHA256 mismatch for osv-scanner v${OSV_VERSION}"
	log_error "Expected: ${EXPECTED}"
	log_error "Actual:   ${ACTUAL}"
	exit 1
fi

log_success "SHA256 verified: ${ACTUAL}"

# Install
chmod +x "${TMPDIR}/osv-scanner"
mv "${TMPDIR}/osv-scanner" "${INSTALL_DIR}/osv-scanner"

# Verify install (use absolute path in case INSTALL_DIR is not in PATH)
"${INSTALL_DIR}/osv-scanner" --version
log_success "osv-scanner v${OSV_VERSION} installed to ${INSTALL_DIR}"

# Ensure INSTALL_DIR is on PATH for subsequent steps
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
	export PATH="${INSTALL_DIR}:${PATH}"
	# Persist for GitHub Actions
	if [[ -n "${GITHUB_PATH:-}" ]]; then
		echo "$INSTALL_DIR" >>"$GITHUB_PATH"
	fi
fi
