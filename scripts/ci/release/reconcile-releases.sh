#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# reconcile-releases.sh
#
# For every recent v*.*.* tag, assert a matching GitHub Release and GHCR
# image exist (#698). This is what would have caught v0.52.3 / v0.52.5:
# the tag and binaries existed, the GitHub Release and image did not, and
# nothing surfaced the gap.
#
# Usage:
#   bash scripts/ci/release/reconcile-releases.sh
#
# Environment:
#   GITHUB_REPOSITORY      owner/repo (required for `gh release view`)
#   GH_TOKEN / GITHUB_TOKEN
#                          Token for `gh`
#   IMAGE_REF              Image without tag (default ghcr.io/lgtm-hq/rustume)
#   TAGS                   Optional whitespace-separated git tags (vX.Y.Z).
#                          When unset, the newest MAX_TAGS version tags are
#                          listed from the local repo (`git tag`).
#   MAX_TAGS               How many newest v*.*.* tags to check (default 50)
#   REGISTRY_USERNAME      Basic-auth user for the registry token endpoint
#   REGISTRY_PASSWORD      Basic-auth password/token (anonymous when unset)
#   CURL_MAX_TIME          curl timeout (default 30)
#   GITHUB_STEP_SUMMARY    When set, a short verdict is appended

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Reconcile v* git tags against GitHub Releases and GHCR images.

Usage:
  bash scripts/ci/release/reconcile-releases.sh

Environment:
  GITHUB_REPOSITORY      owner/repo (required)
  IMAGE_REF              Image without tag (default ghcr.io/lgtm-hq/rustume)
  TAGS                   Explicit vX.Y.Z tag list (default: newest git tags)
  MAX_TAGS               Newest tags to check when TAGS is unset (default 50)
  REGISTRY_USERNAME      Basic-auth user for the registry
  REGISTRY_PASSWORD      Basic-auth password/token
  GITHUB_STEP_SUMMARY    Appends a short verdict when set

Exits non-zero when any checked tag is missing a GitHub Release or image.
EOF
	exit 0
fi

IMAGE_REF="${IMAGE_REF:-ghcr.io/lgtm-hq/rustume}"
MAX_TAGS="${MAX_TAGS:-50}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"

MANIFEST_ACCEPT='application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'

err() { printf '%s\n' "$*" >&2; }

for required_command in curl jq git gh; do
	if ! command -v "$required_command" >/dev/null 2>&1; then
		err "Required command not found: ${required_command}"
		exit 2
	fi
done

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
	err "GITHUB_REPOSITORY is required"
	exit 2
fi

if [[ "$IMAGE_REF" != */* ]]; then
	err "IMAGE_REF must be <registry>/<repository>, got: ${IMAGE_REF}"
	exit 2
fi
REGISTRY="${IMAGE_REF%%/*}"
REPOSITORY="${IMAGE_REF#*/}"

write_summary() {
	[[ -n "${GITHUB_STEP_SUMMARY:-}" ]] || return 0
	printf '%s\n' "$*" >>"$GITHUB_STEP_SUMMARY"
}

list_version_tags() {
	# Newest-first semver tags. Pre-releases (v1.2.3-rc.1) are included;
	# they are still shipped artifacts that must not vanish silently.
	git tag -l 'v*.*.*' --sort=-v:refname | head -n "$MAX_TAGS"
}

expected_tags=()
if [[ -n "${TAGS:-}" ]]; then
	# shellcheck disable=SC2206 # deliberate word splitting of the tag list
	expected_tags=(${TAGS})
else
	while IFS= read -r derived_tag; do
		if [[ -n "$derived_tag" ]]; then
			expected_tags+=("$derived_tag")
		fi
	done < <(list_version_tags)
fi

if [[ ${#expected_tags[@]} -eq 0 ]]; then
	err "No version tags to reconcile (set TAGS or fetch v*.*.* tags)"
	exit 2
fi

fetch_token() {
	local url="https://${REGISTRY}/token?service=${REGISTRY}"
	url+="&scope=repository:${REPOSITORY}:pull"
	local args=(-fsSL --max-time "$CURL_MAX_TIME")
	if [[ -n "${REGISTRY_PASSWORD:-}" ]]; then
		args+=(-u "${REGISTRY_USERNAME:-x}:${REGISTRY_PASSWORD}")
	fi
	curl "${args[@]}" "$url" 2>/dev/null |
		jq -r '.token // .access_token // empty' 2>/dev/null
}

manifest_status() {
	local tag="$1" token="$2" code=""
	code="$(
		curl -sS -o /dev/null -w '%{http_code}' --max-time "$CURL_MAX_TIME" \
			-I -H "Authorization: Bearer ${token}" \
			-H "Accept: ${MANIFEST_ACCEPT}" \
			"https://${REGISTRY}/v2/${REPOSITORY}/manifests/${tag}" \
			2>/dev/null || true
	)"
	printf '%s' "${code:-000}"
}

release_exists() {
	local git_tag="$1"
	gh release view "$git_tag" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1
}

token="$(fetch_token || true)"
if [[ -z "$token" ]]; then
	err "Could not obtain a ${REGISTRY} pull token"
	exit 2
fi

printf 'Reconciling %s tag(s) on %s and %s\n' \
	"${#expected_tags[@]}" "$GITHUB_REPOSITORY" "$IMAGE_REF"

missing_releases=()
missing_images=()

for git_tag in "${expected_tags[@]}"; do
	image_tag="${git_tag#v}"
	if release_exists "$git_tag"; then
		printf '  release present: %s\n' "$git_tag"
	else
		printf '  release MISSING: %s\n' "$git_tag"
		missing_releases+=("$git_tag")
	fi

	status="$(manifest_status "$image_tag" "$token")"
	if [[ "$status" == "200" ]]; then
		printf '  image present:   %s:%s\n' "$IMAGE_REF" "$image_tag"
	else
		printf '  image MISSING:   %s:%s (HTTP %s)\n' \
			"$IMAGE_REF" "$image_tag" "$status"
		missing_images+=("${IMAGE_REF}:${image_tag}")
	fi
done

if [[ ${#missing_releases[@]} -eq 0 && ${#missing_images[@]} -eq 0 ]]; then
	printf 'All %s tag(s) have a GitHub Release and a GHCR image\n' \
		"${#expected_tags[@]}"
	write_summary "✅ Release reconciliation passed for ${#expected_tags[@]} tag(s)"
	exit 0
fi

err "::error::Release reconciliation failed (#698)"
if [[ ${#missing_releases[@]} -ne 0 ]]; then
	err "Missing GitHub Release(s): ${missing_releases[*]}"
fi
if [[ ${#missing_images[@]} -ne 0 ]]; then
	err "Missing GHCR image(s): ${missing_images[*]}"
fi
write_summary "❌ Release reconciliation failed: missing releases=${missing_releases[*]:-none} images=${missing_images[*]:-none}"
exit 1
