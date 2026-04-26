#!/usr/bin/env bash
# Validate the post-pr-comment composite action's body/file inputs.
# Reads from environment variables so untrusted input is never interpolated
# into the script source by the workflow runner.
#
# Required env:
#   INPUT_BODY  Comment body content (mutually exclusive with INPUT_FILE)
#   INPUT_FILE  Path to comment body file (mutually exclusive with INPUT_BODY)

set -euo pipefail

if [[ -n "${INPUT_BODY:-}" && -n "${INPUT_FILE:-}" ]]; then
	echo "::error::Specify either 'body' or 'file', not both"
	exit 1
fi

if [[ -z "${INPUT_BODY:-}" && -z "${INPUT_FILE:-}" ]]; then
	echo "::error::Either 'body' or 'file' must be provided"
	exit 1
fi
