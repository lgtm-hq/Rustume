#!/usr/bin/env bash
set -euo pipefail

# verify-tag-version.sh
# Verify that a git tag matches the version in Cargo.toml.
#
# Usage:
#   TAG=<tag> CARGO_VERSION=<ver> scripts/ci/release/verify-tag-version.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Verify git tag matches the Cargo.toml version.

Usage:
  TAG=<tag> CARGO_VERSION=<ver> scripts/ci/release/verify-tag-version.sh

Environment:
  TAG              Git tag (e.g., v0.1.0)
  CARGO_VERSION    Version from Cargo.toml (without 'v' prefix, e.g., 0.1.0)
EOF
	exit 0
fi

TAG="${TAG:-}"
CARGO_VERSION="${CARGO_VERSION:-}"

if [[ -z "$TAG" || -z "$CARGO_VERSION" ]]; then
	echo "TAG and CARGO_VERSION are required" >&2
	exit 1
fi

EXPECTED="v${CARGO_VERSION}"
if [[ "$TAG" != "$EXPECTED" ]]; then
	echo "Tag mismatch: $TAG != Cargo.toml $EXPECTED" >&2
	exit 1
fi

echo "Tag $TAG matches Cargo.toml version $CARGO_VERSION"
