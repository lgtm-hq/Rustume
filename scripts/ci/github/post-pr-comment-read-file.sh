#!/usr/bin/env bash
# Read the post-pr-comment composite action's `file` input and emit its
# contents as the `content` step output.
#
# Required env:
#   INPUT_FILE     Path to the file whose contents become the comment body
#   GITHUB_OUTPUT  GitHub Actions output sink (provided by the runner)

set -euo pipefail

: "${INPUT_FILE:?INPUT_FILE env var must be set}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT env var must be set}"

if [[ ! -f "${INPUT_FILE}" ]]; then
	echo "::error::Comment file not found: ${INPUT_FILE}"
	exit 1
fi

delim="EOF_$(date +%s%N)"
{
	echo "content<<${delim}"
	cat "${INPUT_FILE}"
	echo "${delim}"
} >>"${GITHUB_OUTPUT}"
