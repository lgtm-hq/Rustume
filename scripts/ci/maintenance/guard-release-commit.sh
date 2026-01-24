#!/usr/bin/env bash
set -euo pipefail

# guard-release-commit.sh
# Check if the last commit is a release bump commit.
#
# Usage:
#   scripts/ci/maintenance/guard-release-commit.sh
#
# Outputs:
#   ok=true|false written to $GITHUB_OUTPUT

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Check if the last commit is a release bump commit.

Usage:
  scripts/ci/maintenance/guard-release-commit.sh

This script checks if the most recent commit message starts with
"chore(release):" which indicates a version bump commit.

Outputs:
  ok=true  - Last commit is a release bump
  ok=false - Last commit is NOT a release bump
EOF
	exit 0
fi

LAST_COMMIT_MSG=$(git log -1 --pretty=%B)

if [[ "$LAST_COMMIT_MSG" =~ ^chore\(release\): ]]; then
	echo "✅ Release bump commit detected: $LAST_COMMIT_MSG"
	[[ -n "${GITHUB_OUTPUT:-}" ]] && echo "ok=true" >>"$GITHUB_OUTPUT"
else
	echo "ℹ️ Not a release bump commit: $LAST_COMMIT_MSG"
	[[ -n "${GITHUB_OUTPUT:-}" ]] && echo "ok=false" >>"$GITHUB_OUTPUT"
fi
