#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
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

# The shared setup-rust action can exit 0 without leaving the toolchain on PATH
# (seen on macos-15-intel: rustup resolves, cargo does not). Recover the
# canonical bin dir ourselves rather than failing three steps later with a bare
# "cargo: command not found", which names the script instead of the cause.
CARGO_BIN="${CARGO_HOME:-$HOME/.cargo}/bin"
if ! command -v "$BUILD_CMD" >/dev/null 2>&1 && [[ -x "$CARGO_BIN/$BUILD_CMD" ]]; then
	echo "$BUILD_CMD not on PATH; adding $CARGO_BIN" >&2
	export PATH="$CARGO_BIN:$PATH"
fi

# macos-15-intel again, one layer deeper (#774): rustup is on PATH but the
# cargo shims never land in CARGO_HOME/bin at all. Ask rustup for the real
# cargo, installing stable first if the image shipped rustup with no
# toolchain. cross is exempt — it is installed separately (cargo install
# cross --locked), never provided by rustup.
if ! command -v "$BUILD_CMD" >/dev/null 2>&1 &&
	[[ "$BUILD_CMD" == "cargo" ]] &&
	command -v rustup >/dev/null 2>&1; then
	if ! rustup which cargo >/dev/null 2>&1; then
		rustup toolchain install stable --profile minimal >&2
		rustup default stable >&2
	fi
	if TOOLCHAIN_CARGO="$(rustup which cargo 2>/dev/null)"; then
		echo "cargo absent from $CARGO_BIN; using $(dirname "$TOOLCHAIN_CARGO") via rustup" >&2
		PATH="$(dirname "$TOOLCHAIN_CARGO"):$PATH"
		export PATH
	fi
fi

if ! command -v "$BUILD_CMD" >/dev/null 2>&1; then
	echo "$BUILD_CMD not found on PATH after checking $CARGO_BIN." >&2
	echo "The Rust toolchain setup did not produce a usable $BUILD_CMD." >&2
	echo "PATH=$PATH" >&2
	exit 1
fi

echo "Building with $BUILD_CMD ($("$BUILD_CMD" --version)) for target $TARGET"
$BUILD_CMD build --release --target "$TARGET" -p rustume-cli
$BUILD_CMD build --release --target "$TARGET" -p rustume-server
