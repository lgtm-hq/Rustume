#!/usr/bin/env bash
set -euo pipefail

# run-lintro-docker.sh
# Run lintro analysis via Docker container in CI.
# Captures output for PR comment generation and sets exit code in GITHUB_ENV.
#
# Usage:
#   LINTRO_IMAGE=<image> WORKSPACE=<path> scripts/ci/lintro/run-lintro-docker.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Run lintro analysis via Docker container.

Usage:
  LINTRO_IMAGE=<image> WORKSPACE=<path> scripts/ci/lintro/run-lintro-docker.sh

Environment:
  LINTRO_IMAGE     Docker image reference (with digest)
  WORKSPACE        Path to mount as /code in the container
  GITHUB_OUTPUT    GitHub Actions output file
  GITHUB_ENV       GitHub Actions environment file
EOF
	exit 0
fi

LINTRO_IMAGE="${LINTRO_IMAGE:-}"
WORKSPACE="${WORKSPACE:-}"

if [[ -z "$LINTRO_IMAGE" || -z "$WORKSPACE" ]]; then
	echo "LINTRO_IMAGE and WORKSPACE are required" >&2
	exit 1
fi

if [[ ! -d "$WORKSPACE" ]]; then
	echo "WORKSPACE directory does not exist: $WORKSPACE" >&2
	exit 1
fi

set +eo pipefail
docker run --rm \
	-v "${WORKSPACE}:/code" \
	"$LINTRO_IMAGE" \
	check --output-format grid 2>&1 | tee chk-output.txt
EXIT_CODE=${PIPESTATUS[0]}
set -eo pipefail

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	echo "exit_code=$EXIT_CODE" >>"$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_ENV:-}" ]]; then
	echo "CHK_EXIT_CODE=$EXIT_CODE" >>"$GITHUB_ENV"
fi
