#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# verify-published-tags.sh
#
# Asserts that the container tags a push/tag build is supposed to publish
# actually resolve in the registry (#597).
#
# Why: `Merge Manifests` in lgtm-ci reusable-docker runs only after EVERY
# platform build succeeds. When a single platform dies (e.g. "The runner has
# received a shutdown signal"), the merge is *skipped* and no tag is pushed —
# while `Release - Auto Tag` and `Publish - GitHub Release` may already have
# produced a git tag and a GitHub Release. The release looks shipped and is
# not. This script turns that into a loud, attributable failure.
#
# Existence is probed with a HEAD against the registry manifest API (the
# authoritative answer, no pull required). When EXPECT_PLATFORMS is set the
# manifest is additionally fetched and its platform list checked, so a
# single-arch manifest published under a multi-arch tag also fails.
#
# Usage:
#   GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v1.2.3 GITHUB_SHA=<sha> \
#     bash scripts/ci/docker/verify-published-tags.sh
#
# Environment:
#   IMAGE_REF              Image without tag (default ghcr.io/lgtm-hq/rustume)
#   TAGS                   Explicit whitespace-separated tag list. When unset,
#                          derived from the ref:
#                            tag  refs/tags/vX.Y.Z -> X.Y.Z latest sha-<short>
#                            main                 -> main sha-<short>
#   EXPECT_PLATFORMS       Comma/space separated os/arch list that every tag's
#                          manifest must contain (default: none)
#   TIMEOUT_SECONDS        Total time to keep polling for missing tags while
#                          the watched build is still running (default 0 =
#                          single pass, fail immediately)
#   POST_SUCCESS_TIMEOUT_SECONDS
#                          Remaining poll budget once WATCH_WORKFLOW has
#                          succeeded (default 600). GHCR read-after-write
#                          lag only — not another 2h wait (#698)
#   POLL_INTERVAL_SECONDS  Delay between polls (default 20)
#   REGISTRY_USERNAME      Basic-auth user for the registry token endpoint
#   REGISTRY_PASSWORD      Basic-auth password/token (anonymous pull if unset)
#   WATCH_WORKFLOW         Optional workflow file name (e.g.
#                          docker-build-publish.yml). While polling, if that
#                          workflow's run for GITHUB_SHA has already concluded
#                          without success, stop waiting and fail immediately.
#                          After it succeeds, the poll budget shrinks to
#                          POST_SUCCESS_TIMEOUT_SECONDS. Best effort: lookup
#                          errors keep polling.
#   GITHUB_REPOSITORY      owner/repo, required by WATCH_WORKFLOW
#   GH_TOKEN               Token for the WATCH_WORKFLOW `gh api` lookup
#   GITHUB_STEP_SUMMARY    When set, a short verdict is appended

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Verify that expected container tags resolve in the registry.

Usage:
  bash scripts/ci/docker/verify-published-tags.sh

Environment:
  IMAGE_REF              Image without tag (default ghcr.io/lgtm-hq/rustume)
  TAGS                   Explicit tag list (default: derived from the ref)
  EXPECT_PLATFORMS       Platforms every tag's manifest must contain
  TIMEOUT_SECONDS        Poll budget while the watched build is running
  POST_SUCCESS_TIMEOUT_SECONDS
                         Remaining budget after a successful watched build
                         (default 600)
  POLL_INTERVAL_SECONDS  Delay between polls (default 20)
  REGISTRY_USERNAME      Basic-auth user for the registry token endpoint
  REGISTRY_PASSWORD      Basic-auth password/token (anonymous when unset)
  WATCH_WORKFLOW         Workflow file to fail fast on (best effort)
  GITHUB_STEP_SUMMARY    Appends a short verdict when set

Exits non-zero when any expected tag is absent or, with EXPECT_PLATFORMS,
publishes a manifest missing an expected platform.
EOF
	exit 0
fi

IMAGE_REF="${IMAGE_REF:-ghcr.io/lgtm-hq/rustume}"
EXPECT_PLATFORMS="${EXPECT_PLATFORMS:-}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-0}"
POST_SUCCESS_TIMEOUT_SECONDS="${POST_SUCCESS_TIMEOUT_SECONDS:-600}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-20}"
CURL_MAX_TIME="${CURL_MAX_TIME:-30}"

MANIFEST_ACCEPT='application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json'

err() { printf '%s\n' "$*" >&2; }

for required_command in curl jq; do
	if ! command -v "$required_command" >/dev/null 2>&1; then
		err "Required command not found: ${required_command}"
		exit 2
	fi
done

if [[ "$IMAGE_REF" != */* ]]; then
	err "IMAGE_REF must be <registry>/<repository>, got: ${IMAGE_REF}"
	exit 2
fi
REGISTRY="${IMAGE_REF%%/*}"
REPOSITORY="${IMAGE_REF#*/}"

# Short SHA must match the length metadata-action uses for its `sha-` tag.
short_sha() {
	local sha="${GITHUB_SHA:-}"
	printf '%s' "${sha:0:7}"
}

# Tags the publish is contracted to produce for the current ref.
derive_tags() {
	local ref_type="${GITHUB_REF_TYPE:-}"
	local ref_name="${GITHUB_REF_NAME:-}"
	local ref="${GITHUB_REF:-}"
	local sha
	sha="$(short_sha)"

	if [[ "$ref_type" != "tag" && "$ref" == refs/tags/* ]]; then
		ref_type="tag"
		ref_name="${ref#refs/tags/}"
	fi

	if [[ "$ref_type" == "tag" ]]; then
		# metadata-action `type=semver` strips the leading v.
		printf '%s\n' "${ref_name#v}" "latest" "sha-${sha}"
		return 0
	fi

	printf '%s\n' "${ref_name:-main}" "sha-${sha}"
}

# Registry pull token. Anonymous unless REGISTRY_PASSWORD is provided.
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

manifest_url() {
	printf 'https://%s/v2/%s/manifests/%s' "$REGISTRY" "$REPOSITORY" "$1"
}

# HTTP status of a HEAD against the tag's manifest.
manifest_status() {
	local tag="$1" token="$2" code=""
	# curl still emits its -w output on transport errors, so capture first and
	# only substitute a placeholder when nothing came back — otherwise a
	# timeout logs the concatenated "000000".
	code="$(
		curl -sS -o /dev/null -w '%{http_code}' --max-time "$CURL_MAX_TIME" \
			-I -H "Authorization: Bearer ${token}" \
			-H "Accept: ${MANIFEST_ACCEPT}" \
			"$(manifest_url "$tag")" 2>/dev/null || true
	)"
	printf '%s' "${code:-000}"
}

# os/arch entries in the tag's manifest index. Attestation manifests carry
# platform "unknown/unknown" and are filtered out.
#
# Every tag reusable-docker publishes — including sha-<short> — points at the
# merged OCI index, not a per-platform digest, so EXPECT_PLATFORMS is valid for
# the whole tag set (verified against ghcr.io/lgtm-hq/rustume for :latest,
# :main, :0.46.0 and :sha-89ce2bf).
manifest_platforms() {
	local tag="$1" token="$2"
	curl -fsSL --max-time "$CURL_MAX_TIME" \
		-H "Authorization: Bearer ${token}" -H "Accept: ${MANIFEST_ACCEPT}" \
		"$(manifest_url "$tag")" 2>/dev/null |
		jq -r '
			.manifests[]?
			| select(.platform.architecture != "unknown")
			| "\(.platform.os)/\(.platform.architecture)"
		' 2>/dev/null || true
	# `|| true`: a fetch/parse failure must surface as "missing platform X",
	# not as a set -e abort that loses the attributable message.
}

# Best effort: conclusion of the watched workflow run for this ref, or empty.
watched_build_conclusion() {
	[[ -n "${WATCH_WORKFLOW:-}" && -n "${GITHUB_REPOSITORY:-}" ]] || return 1
	command -v gh >/dev/null 2>&1 || return 1

	local endpoint runs conclusion
	endpoint="repos/${GITHUB_REPOSITORY}/actions/workflows/${WATCH_WORKFLOW}"
	endpoint+="/runs?head_sha=${GITHUB_SHA:-}&per_page=50"

	# Bound the lookup so a hung API call cannot stall the poll loop.
	local bounded=()
	if command -v timeout >/dev/null 2>&1; then
		bounded=(timeout "$CURL_MAX_TIME")
	fi
	runs="$(${bounded[@]+"${bounded[@]}"} gh api "$endpoint" 2>/dev/null)" ||
		return 1

	# A release-bump commit is reachable from both `main` and the tag, so the
	# same head_sha has two runs. Only the run for THIS ref is relevant.
	conclusion="$(
		printf '%s' "$runs" | jq -r --arg branch "${GITHUB_REF_NAME:-}" '
			[.workflow_runs[]? | select($branch == "" or .head_branch == $branch)]
			| sort_by(.run_number)
			| last
			| select(. != null and .status == "completed")
			| .conclusion // empty
		' 2>/dev/null
	)" || return 1

	printf '%s' "$conclusion"
}

# Best effort: has the watched build already concluded without success?
watched_build_failed() {
	local conclusion
	conclusion="$(watched_build_conclusion)" || return 1
	[[ -n "$conclusion" && "$conclusion" != "success" ]]
}

# Best effort: has the watched build already concluded successfully?
watched_build_succeeded() {
	local conclusion
	conclusion="$(watched_build_conclusion)" || return 1
	[[ "$conclusion" == "success" ]]
}

# Prints success | failed | pending | unknown. Lookup errors are unknown
# (not a confirmed miss) so TIMEOUT_SECONDS cannot clip the GHCR budget.
watched_build_status() {
	local conclusion
	if [[ -z "${WATCH_WORKFLOW:-}" || -z "${GITHUB_REPOSITORY:-}" ]]; then
		printf 'unknown'
		return 0
	fi
	if ! conclusion="$(watched_build_conclusion)"; then
		printf 'unknown'
		return 0
	fi
	if [[ -z "$conclusion" ]]; then
		printf 'pending'
		return 0
	fi
	if [[ "$conclusion" == "success" ]]; then
		printf 'success'
		return 0
	fi
	printf 'failed'
}

write_summary() {
	[[ -n "${GITHUB_STEP_SUMMARY:-}" ]] || return 0
	printf '%s\n' "$*" >>"$GITHUB_STEP_SUMMARY"
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
	done < <(derive_tags)
fi

if [[ ${#expected_tags[@]} -eq 0 ]]; then
	err "No tags to verify (set TAGS or provide ref metadata)"
	exit 2
fi

expected_platforms=()
if [[ -n "$EXPECT_PLATFORMS" ]]; then
	# shellcheck disable=SC2206 # comma/space separated input
	expected_platforms=(${EXPECT_PLATFORMS//,/ })
fi

printf 'Verifying %s tag(s) on %s: %s\n' \
	"${#expected_tags[@]}" "$IMAGE_REF" "${expected_tags[*]}"

missing=("${expected_tags[@]}")
started_at="$SECONDS"
fail_fast=""
success_deadline=""
effective_timeout="$TIMEOUT_SECONDS"

while :; do
	token="$(fetch_token || true)"
	if [[ -z "$token" ]]; then
		err "Warning: could not obtain a ${REGISTRY} pull token; retrying"
	fi

	remaining=()
	for tag in "${missing[@]}"; do
		status="$(manifest_status "$tag" "${token:-}")"
		if [[ "$status" == "200" ]]; then
			printf '  present: %s:%s\n' "$IMAGE_REF" "$tag"
		else
			printf '  MISSING: %s:%s (HTTP %s)\n' "$IMAGE_REF" "$tag" "$status"
			remaining+=("$tag")
		fi
	done
	if [[ ${#remaining[@]} -eq 0 ]]; then
		missing=()
		break
	fi
	missing=("${remaining[@]}")

	watch_status="$(watched_build_status)"
	if [[ "$watch_status" == "failed" ]]; then
		fail_fast="${WATCH_WORKFLOW} already concluded without success"
		break
	fi

	if [[ "$watch_status" == "success" && -z "$success_deadline" ]]; then
		success_deadline=$((SECONDS + POST_SUCCESS_TIMEOUT_SECONDS))
		effective_timeout="$POST_SUCCESS_TIMEOUT_SECONDS"
		printf 'Watched build succeeded; remaining poll budget %ss\n' \
			"$POST_SUCCESS_TIMEOUT_SECONDS"
	fi

	elapsed=$((SECONDS - started_at))
	if [[ -n "$success_deadline" && "$SECONDS" -ge "$success_deadline" ]]; then
		break
	fi
	# Once docker succeeds, only `success_deadline` bounds the wait —
	# the original TIMEOUT_SECONDS must not clip the post-success budget.
	# A transient status lookup at the timeout must not do that either:
	# grant the GHCR window instead of failing the release (#698).
	if [[ -z "$success_deadline" && "$elapsed" -ge "$TIMEOUT_SECONDS" ]]; then
		if [[ -n "${WATCH_WORKFLOW:-}" && "$watch_status" == "unknown" ]]; then
			success_deadline=$((SECONDS + POST_SUCCESS_TIMEOUT_SECONDS))
			effective_timeout="$POST_SUCCESS_TIMEOUT_SECONDS"
			printf 'Watch lookup inconclusive at timeout; granting %ss GHCR budget\n' \
				"$POST_SUCCESS_TIMEOUT_SECONDS"
		else
			break
		fi
	fi

	printf 'Waiting %ss for %s missing tag(s) (%ss/%ss elapsed)\n' \
		"$POLL_INTERVAL_SECONDS" "${#missing[@]}" "$elapsed" "$effective_timeout"
	sleep "$POLL_INTERVAL_SECONDS"
done

if [[ ${#missing[@]} -ne 0 ]]; then
	err "::error::Release image verification failed: ${#missing[@]} expected" \
		"tag(s) absent from ${IMAGE_REF} — ${missing[*]}"
	err "The image was NOT published, so this build did not ship."
	err "A single failed platform skips the manifest merge, which publishes" \
		"no tags at all — treat this as a failed release, not a flaky job."
	if [[ -n "$fail_fast" ]]; then
		err "Stopped waiting: ${fail_fast}"
	fi
	write_summary "❌ Image verification failed: missing ${missing[*]} on ${IMAGE_REF}"
	exit 1
fi

platform_failures=0
if [[ ${#expected_platforms[@]} -ne 0 ]]; then
	token="$(fetch_token || true)"
	for tag in "${expected_tags[@]}"; do
		published="$(manifest_platforms "$tag" "${token:-}")"
		for platform in "${expected_platforms[@]}"; do
			if ! printf '%s\n' "$published" | grep -qxF "$platform"; then
				err "::error::${IMAGE_REF}:${tag} is missing platform ${platform}"
				platform_failures=$((platform_failures + 1))
			fi
		done
	done
fi

if [[ "$platform_failures" -ne 0 ]]; then
	err "Published manifests are not multi-arch; this build did not ship."
	write_summary "❌ Image verification failed: missing platforms on ${IMAGE_REF}"
	exit 1
fi

printf 'All expected tags resolve on %s\n' "$IMAGE_REF"
write_summary "✅ Image verification passed: ${expected_tags[*]} on ${IMAGE_REF}"
