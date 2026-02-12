#!/usr/bin/env bash
set -euo pipefail

# check-bump-needed.sh
# Compare next computed version against current Cargo.toml version.
# Outputs required=true/false to $GITHUB_OUTPUT.
#
# Usage:
#   NEXT_VERSION=<ver> CURRENT_VERSION=<ver> scripts/ci/release/check-bump-needed.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Compare next version vs current version to decide if a bump is needed.

Usage:
  NEXT_VERSION=<ver> CURRENT_VERSION=<ver> scripts/ci/release/check-bump-needed.sh

Environment:
  NEXT_VERSION       Next computed semantic version
  CURRENT_VERSION    Current version from Cargo.toml
  GITHUB_OUTPUT      GitHub Actions output file
EOF
	exit 0
fi

NEXT="${NEXT_VERSION:-}"
CURR="${CURRENT_VERSION:-}"
OUTPUT="${GITHUB_OUTPUT:-/dev/stdout}"

if [[ -n "$NEXT" && "$NEXT" != "$CURR" ]]; then
	echo "required=true" >>"$OUTPUT"
	echo "Version bump required: $CURR -> $NEXT"
else
	echo "required=false" >>"$OUTPUT"
	echo "No version bump required (next=$NEXT, current=$CURR)"
fi
