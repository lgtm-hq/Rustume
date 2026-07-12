#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Run BATS tests for database backup scripts.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_PATH="${ROOT}/tests/bats/unit/backup"

if ! command -v bats >/dev/null 2>&1; then
	echo "bats is required to run backup shell tests" >&2
	exit 1
fi

echo "Running backup shell tests in ${TEST_PATH}"
bats --recursive "${TEST_PATH}"
