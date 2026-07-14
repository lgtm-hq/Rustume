#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# CI wrapper around release_bump_only.sh (#457). Classifies HEAD_SHA against
# BASE_SHA (or HEAD_SHA's first parent when BASE_SHA is unset/empty) and
# writes `bump-only=<true|false>` to GITHUB_OUTPUT.
#
# Used by docker-build-publish.yml (push: BASE_SHA=github.event.before) and
# deploy-railway-cloud.yml (workflow_run: parent of head_sha).

set -euo pipefail

: "${HEAD_SHA:?HEAD_SHA is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

base="${BASE_SHA:-}"
if [[ -z "${base}" ]]; then
	base="$(git rev-parse "${HEAD_SHA}~1")"
fi

result="$("${script_dir}/release_bump_only.sh" "${base}" "${HEAD_SHA}")"

echo "bump-only=${result}" >>"${GITHUB_OUTPUT}"
echo "classified ${base}..${HEAD_SHA}: bump-only=${result}"
