#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/backup/verify-backup-secrets.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	export GITHUB_OUTPUT="${BATS_TEST_TMPDIR}/github_output"
	touch "${GITHUB_OUTPUT}"
}

teardown() {
	teardown_temp_dir
}

@test "verify-backup-secrets: --help exits successfully" {
	run bash "${BACKUP_SCRIPTS_DIR}/verify-backup-secrets.sh" --help

	assert_success
	assert_output --partial "BACKUP_DATABASE_URL"
}

@test "verify-backup-secrets: skips when secrets are missing" {
	run env \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash "${BACKUP_SCRIPTS_DIR}/verify-backup-secrets.sh"

	assert_success
	assert_output --partial "Backup secrets not configured"
	assert_equal "true" "$(get_github_output skip)"
}

@test "verify-backup-secrets: proceeds when all secrets are present" {
	run env \
		BACKUP_DATABASE_URL="postgresql://example" \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash "${BACKUP_SCRIPTS_DIR}/verify-backup-secrets.sh"

	assert_success
	assert_output --partial "All backup secrets present"
	assert_equal "false" "$(get_github_output skip)"
}
