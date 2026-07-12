#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Provision Postgres 16 for Rust CI, migrate, and export TEST_DATABASE_URL.
#
# Reusable Rust test workflows cannot attach GitHub Actions service containers, so
# this script starts an equivalent postgres:16 container with a pg_isready health wait.

set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=postgres}"
: "${POSTGRES_DB:=rustume_test}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_IMAGE:=postgres:16}"
: "${POSTGRES_CONTAINER_NAME:=rustume-ci-postgres}"
: "${POSTGRES_READY_TIMEOUT_SECONDS:=60}"

TEST_DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"

wait_for_postgres() {
	local attempt=0

	while ((attempt < POSTGRES_READY_TIMEOUT_SECONDS)); do
		if docker exec "$POSTGRES_CONTAINER_NAME" \
			pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
			return 0
		fi
		attempt=$((attempt + 1))
		sleep 1
	done

	echo "Postgres did not become ready within ${POSTGRES_READY_TIMEOUT_SECONDS}s" >&2
	return 1
}

start_postgres() {
	if docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER_NAME"; then
		echo "Postgres container ${POSTGRES_CONTAINER_NAME} already running"
		wait_for_postgres
		return 0
	fi

	if docker ps -a --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER_NAME"; then
		echo "Starting existing Postgres container ${POSTGRES_CONTAINER_NAME}..."
		docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
		wait_for_postgres
		return 0
	fi

	echo "Starting Postgres container (${POSTGRES_IMAGE})..."
	docker run -d \
		--name "$POSTGRES_CONTAINER_NAME" \
		-e "POSTGRES_USER=${POSTGRES_USER}" \
		-e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
		-e "POSTGRES_DB=${POSTGRES_DB}" \
		-p "${POSTGRES_PORT}:5432" \
		"$POSTGRES_IMAGE" >/dev/null

	wait_for_postgres
}

start_postgres

export TEST_DATABASE_URL
bash "$GITHUB_WORKSPACE/scripts/ci/testing/rust/run-server-db-migrations.sh"

if [[ -n "${GITHUB_ENV:-}" ]]; then
	echo "TEST_DATABASE_URL=${TEST_DATABASE_URL}" >>"$GITHUB_ENV"
fi

: "${INSTALL_COVERAGE_TOOLS:=false}"
export INSTALL_COVERAGE_TOOLS
bash "$GITHUB_WORKSPACE/.lgtm-ci-tooling/scripts/ci/testing/rust/setup-rust-nextest.sh"
