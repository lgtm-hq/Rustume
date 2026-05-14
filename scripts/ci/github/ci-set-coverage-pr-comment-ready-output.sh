#!/usr/bin/env bash

# SPDX-License-Identifier: MIT

# Sets step output `ready` for coverage workflows when the PR comment artifact
# should be uploaded (same-repository PR, generate comment succeeded).
#
# Environment variables:
#   EVENT_NAME                         github.event_name (e.g. pull_request).
#   GENERATE_COMMENT_STEP_OUTCOME       outcome of the generate-*-comment step.
#   PR_HEAD_REPO_IS_FORK               github.event.pull_request.head.repo.fork;
#                                      omit or false for non-PR events (caller passes safely).
#   GITHUB_OUTPUT                      Actions-provided path for step outputs (required).

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
	echo "Usage: $0 [--help]"
	echo ""
	echo "Writes ready=true|false to GITHUB_OUTPUT for coverage PR comment upload gates."
	exit 0
fi

if [ -z "${GITHUB_OUTPUT:-}" ]; then
	echo "GITHUB_OUTPUT is required (GitHub Actions step output file)." >&2
	exit 1
fi

ready=false
fork="${PR_HEAD_REPO_IS_FORK:-false}"
case "$(printf '%s' "$fork" | tr '[:upper:]' '[:lower:]')" in
true | yes | 1) is_fork=true ;;
*) is_fork=false ;;
esac

if [[ "${EVENT_NAME:-}" == "pull_request" ]] &&
	[[ "${GENERATE_COMMENT_STEP_OUTCOME:-}" == "success" ]] &&
	[[ "$is_fork" == "false" ]]; then
	ready=true
fi

echo "ready=$ready" >>"$GITHUB_OUTPUT"
