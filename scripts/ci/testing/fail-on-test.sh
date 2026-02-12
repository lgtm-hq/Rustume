#!/usr/bin/env bash
set -euo pipefail

# fail-on-test.sh
# Fail the CI job with a clear message when tests did not pass.
#
# Usage:
#   TEST_EXIT_CODE=<code> scripts/ci/testing/fail-on-test.sh

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Fail the step when tests failed.

Usage:
  TEST_EXIT_CODE=<code> scripts/ci/testing/fail-on-test.sh

Environment:
  TEST_EXIT_CODE  Exit code from previous test step (non-zero means failure)
EOF
	exit 0
fi

code="${TEST_EXIT_CODE:-}"
if [[ -z "$code" ]]; then
	echo "TEST_EXIT_CODE is required" >&2
	exit 2
fi

if [[ "$code" != "0" ]]; then
	echo "Tests failed (exit code: $code)"
	exit 1
fi
