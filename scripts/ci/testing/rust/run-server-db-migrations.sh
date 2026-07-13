#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Apply server SQLx migrations against TEST_DATABASE_URL for CI.

set -euo pipefail

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
: "${SQLX_CLI_VERSION:=0.9.0}"
: "${MIGRATIONS_DIR:=crates/server/src/db/migrations}"

if ! command -v sqlx >/dev/null 2>&1; then
	echo "Installing sqlx-cli ${SQLX_CLI_VERSION}..."
	cargo install sqlx-cli \
		--no-default-features \
		--features rustls,postgres \
		--locked \
		--force \
		--version "$SQLX_CLI_VERSION"
fi

echo "Running SQLx migrations from ${MIGRATIONS_DIR}..."
sqlx migrate run \
	--source "$MIGRATIONS_DIR" \
	--database-url "$TEST_DATABASE_URL"
