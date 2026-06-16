#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Run BATS tests for Railway deploy scripts.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_PATH="${ROOT}/tests/bats/unit/railway"

if ! command -v bats >/dev/null 2>&1; then
	echo "bats is required to run Railway shell tests" >&2
	exit 1
fi

# Prevent accidental live Railway calls when developers have tokens exported locally.
clear_railway_tokens() {
	unset RAILWAY_TOKEN RAILWAY_API_TOKEN
}
clear_railway_tokens

echo "Running Railway shell tests in ${TEST_PATH}"
bats --recursive "${TEST_PATH}"
