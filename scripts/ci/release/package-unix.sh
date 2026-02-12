#!/usr/bin/env bash
set -euo pipefail

# package-unix.sh
# Package built binaries into a tarball with checksums.
# Fails if required binaries are missing.
#
# Usage:
#   VERSION=<ver> TARGET=<target> scripts/ci/release/package-unix.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Package release binaries into a .tar.gz archive with SHA256 checksum.

Usage:
  VERSION=<ver> TARGET=<target> scripts/ci/release/package-unix.sh

Environment:
  VERSION   Release version (e.g., 0.1.0)
  TARGET    Rust target triple (e.g., x86_64-unknown-linux-gnu)
EOF
	exit 0
fi

VERSION="${VERSION:-}"
TARGET="${TARGET:-}"

if [[ -z "$VERSION" || -z "$TARGET" ]]; then
	echo "VERSION and TARGET are required" >&2
	exit 1
fi

CLI_BIN="target/${TARGET}/release/rustume"
SRV_BIN="target/${TARGET}/release/rustume-server"

# Verify required binaries exist
missing=0
for bin in "$CLI_BIN" "$SRV_BIN"; do
	if [[ ! -f "$bin" ]]; then
		echo "Required binary not found: $bin" >&2
		missing=$((missing + 1))
	fi
done
if [[ "$missing" -gt 0 ]]; then
	echo "Aborting: $missing required binary/binaries missing" >&2
	exit 1
fi

STAGING="rustume-${VERSION}-${TARGET}"
if [[ -n "$STAGING" ]]; then
	rm -rf "$STAGING"
fi
mkdir -p "$STAGING"
cp "$CLI_BIN" "$STAGING/"
cp "$SRV_BIN" "$STAGING/"
cp README.md LICENSE "$STAGING/" 2>/dev/null || true
tar czf "${STAGING}.tar.gz" "$STAGING"
shasum -a 256 "${STAGING}.tar.gz" >"${STAGING}.tar.gz.sha256"
rm -rf "$STAGING"
echo "Packaged ${STAGING}.tar.gz"
