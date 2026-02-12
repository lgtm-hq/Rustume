#!/usr/bin/env bash
set -euo pipefail

# enable-auto-merge.sh
# Enable auto-merge (squash) on a pull request.
#
# Usage:
#   PR_NUMBER=<number> scripts/ci/release/enable-auto-merge.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Enable auto-merge on a release pull request.

Usage:
  PR_NUMBER=<number> scripts/ci/release/enable-auto-merge.sh

Environment:
  PR_NUMBER      Pull request number to auto-merge
  GITHUB_TOKEN   Token for gh CLI authentication
EOF
	exit 0
fi

PR="${PR_NUMBER:-}"
if [[ -z "$PR" ]]; then
	echo "PR_NUMBER is required" >&2
	exit 1
fi

gh pr merge "$PR" --auto --squash || {
	echo "Auto-merge not available; requires manual merge."
}
