#!/usr/bin/env bash
set -euo pipefail

# ghcr-prune-untagged.sh
# Prune untagged container image versions from GitHub Container Registry.
#
# Usage:
#   scripts/ci/maintenance/ghcr-prune-untagged.sh
#
# Environment:
#   GITHUB_TOKEN              GitHub token with packages:write (required)
#   GHCR_PRUNE_MIN_AGE_DAYS   Minimum age in days before deletion (default: 7)
#   GHCR_PRUNE_DRY_RUN        Set to "1" for dry run (default: 0)

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Prune untagged GHCR container image versions.

Usage:
  scripts/ci/maintenance/ghcr-prune-untagged.sh

Environment:
  GITHUB_TOKEN              GitHub token with packages:write (required)
  GHCR_PRUNE_MIN_AGE_DAYS   Minimum age in days before deletion (default: 7)
  GHCR_PRUNE_DRY_RUN        Set to "1" for dry run (default: 0)
EOF
	exit 0
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
	echo "GITHUB_TOKEN is required" >&2
	exit 1
fi

MIN_AGE_DAYS="${GHCR_PRUNE_MIN_AGE_DAYS:-7}"
DRY_RUN="${GHCR_PRUNE_DRY_RUN:-0}"
PACKAGE_NAME="rustume"

echo "GHCR Prune — package: $PACKAGE_NAME, min age: ${MIN_AGE_DAYS}d, dry run: $DRY_RUN"

# Calculate cutoff date (ISO 8601)
CUTOFF_DATE=$(date -u -d "-${MIN_AGE_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
	date -u -v "-${MIN_AGE_DAYS}d" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
	echo "")

if [[ -z "$CUTOFF_DATE" ]]; then
	echo "Could not compute cutoff date" >&2
	exit 1
fi

echo "Cutoff date: $CUTOFF_DATE"

# Determine org or user for API path
if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
	OWNER="${GITHUB_REPOSITORY%%/*}"
else
	OWNER=$(gh api /user --jq '.login' 2>/dev/null || echo "")
	if [[ -z "$OWNER" ]]; then
		echo "Cannot determine repository owner" >&2
		exit 1
	fi
fi

# List all versions of the package
API_PATH="/orgs/${OWNER}/packages/container/${PACKAGE_NAME}/versions"
VERSIONS=$(gh api "$API_PATH" --paginate --jq '
	.[] | select(.metadata.container.tags | length == 0) |
	{id: .id, created_at: .metadata.created_at, name: .name}
' 2>/dev/null || echo "")

if [[ -z "$VERSIONS" ]]; then
	echo "No untagged versions found."
	exit 0
fi

deleted=0
skipped=0

while IFS= read -r version_json; do
	[[ -z "$version_json" ]] && continue
	VERSION_ID=$(echo "$version_json" | jq -r '.id')
	CREATED_AT=$(echo "$version_json" | jq -r '.created_at')
	VERSION_NAME=$(echo "$version_json" | jq -r '.name')

	# Skip versions newer than cutoff
	if [[ "$CREATED_AT" > "$CUTOFF_DATE" ]]; then
		skipped=$((skipped + 1))
		continue
	fi

	if [[ "$DRY_RUN" == "1" ]]; then
		echo "[dry-run] Would delete version $VERSION_ID ($VERSION_NAME, created $CREATED_AT)"
		deleted=$((deleted + 1))
	else
		echo "Deleting version $VERSION_ID ($VERSION_NAME, created $CREATED_AT)"
		gh api --method DELETE "$API_PATH/$VERSION_ID" 2>/dev/null || {
			echo "Failed to delete version $VERSION_ID" >&2
		}
		deleted=$((deleted + 1))
	fi
done <<<"$VERSIONS"

echo "Done. Deleted: $deleted, Skipped (too recent): $skipped"
