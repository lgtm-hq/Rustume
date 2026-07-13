#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: CI entrypoint for server DB integration tests with a Postgres service container.

set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"

bash "$GITHUB_WORKSPACE/scripts/ci/testing/rust/run-server-db-migrations.sh"
bash "$GITHUB_WORKSPACE/scripts/ci/testing/rust/run-server-db-integration-tests.sh"
