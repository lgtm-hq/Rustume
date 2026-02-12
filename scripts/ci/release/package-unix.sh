#!/usr/bin/env bash
set -euo pipefail

# package-unix.sh
# Package built binaries into a tarball with checksums.
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

STAGING="rustume-${VERSION}-${TARGET}"
mkdir -p "$STAGING"
cp "target/${TARGET}/release/rustume" "$STAGING/" 2>/dev/null || true
cp "target/${TARGET}/release/rustume-server" "$STAGING/" 2>/dev/null || true
cp README.md LICENSE "$STAGING/" 2>/dev/null || true
tar czf "${STAGING}.tar.gz" "$STAGING"
shasum -a 256 "${STAGING}.tar.gz" >"${STAGING}.tar.gz.sha256"
echo "Packaged ${STAGING}.tar.gz"
