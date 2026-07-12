#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/backup/prune-backups.sh

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

setup_prune_mocks() {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	mkdir -p "${mock_bin}"
	cp "${PROJECT_ROOT}/tests/bats/fixtures/backup/mock-aws.sh" "${mock_bin}/aws"
	chmod +x "${mock_bin}/aws"
	export PATH="${mock_bin}:${PATH}"
}

reference_epoch() {
	date -u -d "$1" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d %H:%M:%S" "$1" +%s
}

write_listing() {
	local file="$1"
	shift
	: >"${file}"
	for key in "$@"; do
		echo "2024-01-01 00:00:00    1024 ${key}" >>"${file}"
	done
}

@test "prune-backups: --help exits successfully" {
	run bash "${BACKUP_SCRIPTS_DIR}/prune-backups.sh" --help

	assert_success
	assert_output --partial "grandfather-father-son"
}

@test "prune-backups: keeps daily backups and deletes older duplicates" {
	local list_file="${BATS_TEST_TMPDIR}/objects.txt"
	local delete_log="${BATS_TEST_TMPDIR}/deletes.log"
	touch "${delete_log}"

	write_listing "${list_file}" \
		"rustume-production-20240711T030000Z.dump.gz" \
		"rustume-production-20240710T030000Z.dump.gz" \
		"rustume-production-20240709T030000Z.dump.gz" \
		"rustume-production-20240708T030000Z.dump.gz" \
		"rustume-production-20240707T030000Z.dump.gz" \
		"rustume-production-20240706T030000Z.dump.gz" \
		"rustume-production-20240705T030000Z.dump.gz" \
		"rustume-production-20240704T030000Z.dump.gz"

	setup_prune_mocks

	run env \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		BACKUP_REFERENCE_EPOCH="$(reference_epoch "2024-07-12 03:00:00")" \
		MOCK_AWS_LS_FILE="${list_file}" \
		MOCK_AWS_DELETE_LOG="${delete_log}" \
		bash "${BACKUP_SCRIPTS_DIR}/prune-backups.sh"

	assert_success
	assert_output --partial "Keeping rustume-production-20240711T030000Z.dump.gz"
	assert_output --partial "Deleting rustume-production-20240704T030000Z.dump.gz"
	assert_equal "rustume-production-20240704T030000Z.dump.gz" "$(cat "${delete_log}")"
}

@test "prune-backups: keeps weekly backup at daily boundary" {
	local list_file="${BATS_TEST_TMPDIR}/objects.txt"
	local delete_log="${BATS_TEST_TMPDIR}/deletes.log"
	touch "${delete_log}"

	write_listing "${list_file}" \
		"rustume-production-20240712T030000Z.dump.gz" \
		"rustume-production-20240705T030000Z.dump.gz" \
		"rustume-production-20240704T030000Z.dump.gz"

	setup_prune_mocks

	run env \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		BACKUP_REFERENCE_EPOCH="$(reference_epoch "2024-07-12 03:00:00")" \
		MOCK_AWS_LS_FILE="${list_file}" \
		MOCK_AWS_DELETE_LOG="${delete_log}" \
		bash "${BACKUP_SCRIPTS_DIR}/prune-backups.sh"

	assert_success
	assert_output --partial "Keeping rustume-production-20240705T030000Z.dump.gz"
	assert_output --partial "Deleting rustume-production-20240704T030000Z.dump.gz"
}

@test "prune-backups: dry-run makes no deletions" {
	local list_file="${BATS_TEST_TMPDIR}/objects.txt"
	local delete_log="${BATS_TEST_TMPDIR}/deletes.log"
	touch "${delete_log}"

	write_listing "${list_file}" \
		"rustume-production-20240712T030000Z.dump.gz" \
		"rustume-production-20231201T030000Z.dump.gz"

	setup_prune_mocks

	run env \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		BACKUP_REFERENCE_EPOCH="$(reference_epoch "2024-07-12 03:00:00")" \
		MOCK_AWS_LS_FILE="${list_file}" \
		MOCK_AWS_DELETE_LOG="${delete_log}" \
		bash "${BACKUP_SCRIPTS_DIR}/prune-backups.sh" --dry-run

	assert_success
	assert_output --partial "[dry-run] Would delete rustume-production-20231201T030000Z.dump.gz"
	[[ ! -s "${delete_log}" ]]
}

@test "prune-backups: keeps one monthly backup beyond weekly window" {
	local list_file="${BATS_TEST_TMPDIR}/objects.txt"
	local delete_log="${BATS_TEST_TMPDIR}/deletes.log"
	touch "${delete_log}"

	write_listing "${list_file}" \
		"rustume-production-20240712T030000Z.dump.gz" \
		"rustume-production-20240515T030000Z.dump.gz" \
		"rustume-production-20240510T030000Z.dump.gz" \
		"rustume-production-20240420T030000Z.dump.gz"

	setup_prune_mocks

	run env \
		R2_ACCOUNT_ID="acct" \
		R2_ACCESS_KEY_ID="key" \
		R2_SECRET_ACCESS_KEY="secret" \
		R2_BACKUP_BUCKET="backups" \
		BACKUP_REFERENCE_EPOCH="$(reference_epoch "2024-07-12 03:00:00")" \
		MOCK_AWS_LS_FILE="${list_file}" \
		MOCK_AWS_DELETE_LOG="${delete_log}" \
		bash "${BACKUP_SCRIPTS_DIR}/prune-backups.sh"

	assert_success
	assert_output --partial "Keeping rustume-production-20240515T030000Z.dump.gz"
	assert_output --partial "Deleting rustume-production-20240510T030000Z.dump.gz"
	assert_output --partial "Keeping rustume-production-20240420T030000Z.dump.gz"
}
