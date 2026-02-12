#!/usr/bin/env bash
set -euo pipefail

# build-binaries.sh
# Build release binaries using cargo or cross (for cross-compilation).
#
# Usage:
#   TARGET=<target> [USE_CROSS=true] scripts/ci/release/build-binaries.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Build release binaries for a specific target.

Usage:
  TARGET=<target> [USE_CROSS=true] scripts/ci/release/build-binaries.sh

Environment:
  TARGET      Rust target triple (e.g., x86_64-unknown-linux-gnu)
  USE_CROSS   Set to "true" to use cross instead of cargo
EOF
	exit 0
fi

TARGET="${TARGET:-}"
if [[ -z "$TARGET" ]]; then
	echo "TARGET is required" >&2
	exit 1
fi

BUILD_CMD="cargo"
if [[ "${USE_CROSS:-}" == "true" ]]; then
	BUILD_CMD="cross"
fi

echo "Building with $BUILD_CMD for target $TARGET"
$BUILD_CMD build --release --target "$TARGET" -p rustume-cli
$BUILD_CMD build --release --target "$TARGET" -p rustume-server
