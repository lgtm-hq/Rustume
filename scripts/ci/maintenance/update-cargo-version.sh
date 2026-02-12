#!/usr/bin/env bash
set -euo pipefail

# update-cargo-version.sh
# Update the workspace version in root Cargo.toml.
#
# Usage:
#   scripts/ci/maintenance/update-cargo-version.sh <version> [--dry-run]
#
# Arguments:
#   version   New semantic version (e.g., 0.2.0)
#   --dry-run Show what would change without modifying files

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Update the workspace version in root Cargo.toml.

Usage:
  scripts/ci/maintenance/update-cargo-version.sh <version> [--dry-run]

Arguments:
  version   New semantic version (e.g., 0.2.0)
  --dry-run Show what would change without modifying files
EOF
	exit 0
fi

VERSION="${1:-}"
DRY_RUN=false
if [[ "${2:-}" == "--dry-run" ]]; then
	DRY_RUN=true
fi

if [[ -z "$VERSION" ]]; then
	echo "Usage: update-cargo-version.sh <version> [--dry-run]" >&2
	exit 1
fi

# Validate version format
if ! echo "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
	echo "Invalid version format: $VERSION (expected X.Y.Z)" >&2
	exit 1
fi

CARGO_TOML="Cargo.toml"
if [[ ! -f "$CARGO_TOML" ]]; then
	echo "Cargo.toml not found in current directory" >&2
	exit 1
fi

# Read current version
CURRENT=$(grep -m1 '^version = ' "$CARGO_TOML" | sed 's/version = "\(.*\)"/\1/')
if [[ -z "$CURRENT" ]]; then
	echo "Could not read current version from $CARGO_TOML" >&2
	exit 1
fi

if [[ "$CURRENT" == "$VERSION" ]]; then
	echo "Version is already $VERSION — no update needed."
	exit 0
fi

echo "Updating $CARGO_TOML: $CURRENT -> $VERSION"

if $DRY_RUN; then
	echo "[dry-run] Would update version = \"$CURRENT\" to version = \"$VERSION\""
	exit 0
fi

# Update the version line (first occurrence only, under [workspace.package])
sed -i.bak "0,/^version = \"${CURRENT}\"/s//version = \"${VERSION}\"/" "$CARGO_TOML"
rm -f "${CARGO_TOML}.bak"

# Verify the update
UPDATED=$(grep -m1 '^version = ' "$CARGO_TOML" | sed 's/version = "\(.*\)"/\1/')
if [[ "$UPDATED" != "$VERSION" ]]; then
	echo "Verification failed: expected $VERSION but got $UPDATED" >&2
	exit 1
fi

echo "Updated $CARGO_TOML to version $VERSION"
