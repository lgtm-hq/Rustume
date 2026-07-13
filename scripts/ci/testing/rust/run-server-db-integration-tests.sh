#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Run server DB-backed integration tests that require TEST_DATABASE_URL.

set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
: "${NEXTEST_PROFILE:=ci}"

nextest_args=(
	run
	-p rustume-server
	--profile "$NEXTEST_PROFILE"
	--all-features
	-E 'test(/export_resumes_|looks_like_test_database_url/)'
)

echo "Running: cargo nextest ${nextest_args[*]}"
cargo nextest "${nextest_args[@]}"
