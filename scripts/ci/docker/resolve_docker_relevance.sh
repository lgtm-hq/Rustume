#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# resolve_docker_relevance.sh
#
# Deny-by-default path classification for docker-build-publish.yml (#476).
# Writes `pipeline=true|false` and `skip-reason` to GITHUB_OUTPUT.
#
# Pipeline=false only when EVERY changed file matches the skip-list:
#   - '*.md' / '**/*.md'  markdown prose
#   - 'docs/**'           documentation tree
#
# Everything else — including brand-new top-level directories — runs Docker.
# Classification failures and empty/unavailable diffs fail open (pipeline=true).
#
# Non-pull_request events always resolve pipeline=true (push/tag/dispatch
# still run; bump-only skipping is handled separately by classify_release_bump.sh).
#
# Usage:
#   EVENT_NAME=pull_request BASE_SHA=... HEAD_SHA=... \
#     bash scripts/ci/docker/resolve_docker_relevance.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Resolve Docker pipeline path relevance for GitHub Actions.

Usage:
  EVENT_NAME=<event> [BASE_SHA=...] [HEAD_SHA=...] \
    bash scripts/ci/docker/resolve_docker_relevance.sh

Environment:
  EVENT_NAME  github.event_name
  BASE_SHA    Diff base (required for pull_request classification overrides)
  HEAD_SHA    Diff head
  GITHUB_OUTPUT  When set, appends pipeline / skip-reason outputs

Behavior:
  - Non-pull_request events always resolve pipeline=true.
  - pull_request events resolve pipeline=false only when EVERY changed file
    matches the skip-list ('*.md', 'docs/*'). Fail open otherwise.
EOF
	exit 0
fi

event_name="${EVENT_NAME:-}"
pipeline="true"
skip_reason=""

# A changed file may skip Docker only when this returns 0.
is_skippable_path() {
	local path="$1"
	case "$path" in
	*.md) return 0 ;;
	docs | docs/*) return 0 ;;
	esac
	return 1
}

resolve_changed_files() {
	local base="${BASE_SHA:-}"
	local head="${HEAD_SHA:-}"
	if [[ -z "$base" || -z "$head" ]]; then
		if ! git rev-parse --verify --quiet 'HEAD^2' >/dev/null 2>&1; then
			return 1
		fi
		base="$(git rev-parse 'HEAD^1')"
		head="$(git rev-parse HEAD)"
	fi
	git diff --name-only --no-renames "$base" "$head"
}

if [[ "$event_name" == "pull_request" ]]; then
	if changed_files="$(resolve_changed_files 2>/dev/null)" &&
		[[ -n "$changed_files" ]]; then
		pipeline="false"
		while IFS= read -r changed_file; do
			[[ -z "$changed_file" ]] && continue
			if ! is_skippable_path "$changed_file"; then
				pipeline="true"
				break
			fi
		done <<<"$changed_files"
	else
		echo "::warning::changed-file list unavailable (non-merge HEAD," \
			"failed or empty diff); failing open (pipeline=true)"
		pipeline="true"
	fi
fi

if [[ "$pipeline" == "false" ]]; then
	skip_reason="docs-only change"
fi

echo "event=${event_name:-<unset>} pipeline=${pipeline}" \
	"skip-reason=${skip_reason:-<none>}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	{
		echo "pipeline=${pipeline}"
		echo "skip-reason=${skip_reason}"
	} >>"$GITHUB_OUTPUT"
else
	echo "pipeline=${pipeline}"
	echo "skip-reason=${skip_reason}"
fi
