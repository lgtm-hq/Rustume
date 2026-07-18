#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/backup/dry-run-backup.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
}

teardown() {
	restore_path
	teardown_temp_dir
}

setup_pg_dump_mock() {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	mkdir -p "${mock_bin}"
	cp "${PROJECT_ROOT}/tests/bats/fixtures/backup/mock-pg-dump.sh" "${mock_bin}/pg_dump"
	chmod +x "${mock_bin}/pg_dump"
	export PATH="${mock_bin}:${PATH}"
}

@test "dry-run-backup: --help exits successfully" {
	run bash "${BACKUP_SCRIPTS_DIR}/dry-run-backup.sh" --help

	assert_success
	assert_output --partial "BACKUP_DATABASE_URL"
}

@test "dry-run-backup: fails when BACKUP_DATABASE_URL is missing" {
	run bash "${BACKUP_SCRIPTS_DIR}/dry-run-backup.sh"

	assert_failure
	assert_output --partial "BACKUP_DATABASE_URL is required"
}

@test "dry-run-backup: succeeds with mocked pg_dump" {
	setup_pg_dump_mock

	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		bash "${BACKUP_SCRIPTS_DIR}/dry-run-backup.sh"

	assert_success
	assert_output --partial "Dry run pg_dump succeeded"
}

@test "dry-run-backup: fails when pg_dump produces empty output" {
	setup_pg_dump_mock

	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		MOCK_PG_DUMP_EMPTY="1" \
		bash "${BACKUP_SCRIPTS_DIR}/dry-run-backup.sh"

	assert_failure
	assert_output --partial "pg_dump produced an empty file during dry run"
}
