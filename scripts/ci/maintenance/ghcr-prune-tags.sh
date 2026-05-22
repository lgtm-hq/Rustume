#!/usr/bin/env bash
set -euo pipefail

# Prune aged tagged GHCR versions while preserving release tags.
#
# Retention policy:
#   - latest, semver (x.y.z, x.y, x): keep forever
#   - main, sha-*: delete when older than MAIN_RETENTION_DAYS (default 30)
#   - pre-release / RC tags: delete when older than PRERELEASE_RETENTION_DAYS (default 90)
#
# Environment:
#   GITHUB_TOKEN                 GitHub token with packages:write (required)
#   GHCR_PRUNE_DRY_RUN           Set to "1" for dry run (default: 0)
#   GHCR_MAIN_RETENTION_DAYS     Retention for main/sha-* tags (default: 30)
#   GHCR_PRERELEASE_RETENTION_DAYS Retention for pre-release tags (default: 90)
#   GHCR_PACKAGE_NAME            GHCR package name (default: rustume)

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Prune aged tagged GHCR container image versions.

Usage:
  scripts/ci/maintenance/ghcr-prune-tags.sh
EOF
	exit 0
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
	echo "GITHUB_TOKEN is required" >&2
	exit 1
fi

DRY_RUN="${GHCR_PRUNE_DRY_RUN:-0}"
MAIN_RETENTION_DAYS="${GHCR_MAIN_RETENTION_DAYS:-30}"
PRERELEASE_RETENTION_DAYS="${GHCR_PRERELEASE_RETENTION_DAYS:-90}"
PACKAGE_NAME="${GHCR_PACKAGE_NAME:-rustume}"

main_cutoff=$(date -u -d "-${MAIN_RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
	date -u -v "-${MAIN_RETENTION_DAYS}d" +%Y-%m-%dT%H:%M:%SZ)
prerelease_cutoff=$(date -u -d "-${PRERELEASE_RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
	date -u -v "-${PRERELEASE_RETENTION_DAYS}d" +%Y-%m-%dT%H:%M:%SZ)

owner="${GITHUB_REPOSITORY%%/*}"
if gh api "/orgs/${owner}" --silent 2>/dev/null; then
	api_path="/orgs/${owner}/packages/container/${PACKAGE_NAME}/versions"
else
	api_path="/users/${owner}/packages/container/${PACKAGE_NAME}/versions"
fi

should_delete_tag() {
	local tag="$1"
	local created_at="$2"

	if [[ "$tag" == "latest" ]]; then
		return 1
	fi
	if [[ "$tag" =~ ^[0-9]+(\.[0-9]+)?(\.[0-9]+)?$ ]]; then
		return 1
	fi
	if [[ "$tag" == "main" || "$tag" == sha-* ]]; then
		[[ "$created_at" < "$main_cutoff" ]]
		return
	fi
	if [[ "$tag" =~ (^|.*-)(alpha|beta|rc|pre|dev|snapshot)(.*|$) ]]; then
		[[ "$created_at" < "$prerelease_cutoff" ]]
		return
	fi
	return 1
}

deleted=0
skipped=0

while IFS=$'\t' read -r version_id created_at tags_json; do
	[[ -n "$version_id" ]] || continue
	mapfile -t tags < <(echo "$tags_json" | jq -r '.[]')

	all_deletable=true
	for tag in "${tags[@]}"; do
		if ! should_delete_tag "$tag" "$created_at"; then
			all_deletable=false
			break
		fi
	done

	if [[ "$all_deletable" == "true" ]]; then
		if [[ "$DRY_RUN" == "1" ]]; then
			echo "[dry-run] Would delete version ${version_id} (tags: ${tags[*]}, created ${created_at})"
		else
			echo "Deleting version ${version_id} (tags: ${tags[*]}, created ${created_at})"
			gh api --method DELETE "${api_path}/${version_id}" || {
				echo "Failed to delete version ${version_id}" >&2
				exit 1
			}
		fi
		deleted=$((deleted + 1))
		continue
	fi
	skipped=$((skipped + 1))
done < <(
	gh api "$api_path" --paginate --jq \
		'.[] | select(.metadata.container.tags | length > 0) | [.id, .created_at, (.metadata.container.tags | @json)] | @tsv'
)

echo "Done. Deleted: ${deleted}, Skipped: ${skipped}"
