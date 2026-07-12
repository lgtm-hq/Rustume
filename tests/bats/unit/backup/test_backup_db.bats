#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/backup/backup-db.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
	export GITHUB_OUTPUT="${BATS_TEST_TMPDIR}/github_output"
	touch "${GITHUB_OUTPUT}"
}

teardown() {
	restore_path
	teardown_temp_dir
}

setup_backup_mocks() {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	mkdir -p "${mock_bin}"
	cp "${PROJECT_ROOT}/tests/bats/fixtures/backup/mock-pg-dump.sh" "${mock_bin}/pg_dump"
	cp "${PROJECT_ROOT}/tests/bats/fixtures/backup/mock-aws.sh" "${mock_bin}/aws"
	chmod +x "${mock_bin}/pg_dump" "${mock_bin}/aws"
	export PATH="${mock_bin}:${PATH}"
}

@test "backup-db: --help exits successfully" {
	run bash "${BACKUP_SCRIPTS_DIR}/backup-db.sh" --help

	assert_success
	assert_output --partial "BACKUP_DATABASE_URL"
}

@test "backup-db: fails when required env is missing" {
	run bash "${BACKUP_SCRIPTS_DIR}/backup-db.sh"

	assert_failure
	assert_output --partial "BACKUP_DATABASE_URL is required"
}

@test "backup-db: uploads object with expected naming" {
	local upload_log="${BATS_TEST_TMPDIR}/upload.log"
	touch "${upload_log}"

	setup_backup_mocks

	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		BACKUP_ENV="staging" \
		BACKUP_TIMESTAMP="20240712T030000Z" \
		MOCK_AWS_UPLOAD_LOG="${upload_log}" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash "${BACKUP_SCRIPTS_DIR}/backup-db.sh"

	assert_success
	assert_output --partial "Backup uploaded"
	assert_equal "rustume-staging-20240712T030000Z.dump.gz" "$(get_github_output object_key)"
	assert_equal "s3://backups/rustume-staging-20240712T030000Z.dump.gz" "$(cat "${upload_log}")"
}

@test "backup-db: aborts when pg_dump produces empty output" {
	setup_backup_mocks

	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		MOCK_PG_DUMP_EMPTY="1" \
		bash "${BACKUP_SCRIPTS_DIR}/backup-db.sh"

	assert_failure
	assert_output --partial "pg_dump produced an empty file"
}

@test "backup-db: propagates upload failure" {
	setup_backup_mocks

	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		MOCK_AWS_UPLOAD_FAIL="1" \
		bash "${BACKUP_SCRIPTS_DIR}/backup-db.sh"

	assert_failure
	assert_output --partial "Upload to R2 failed"
}
