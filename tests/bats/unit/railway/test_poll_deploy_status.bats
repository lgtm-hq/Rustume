#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/railway/poll-deploy-status.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
	clear_railway_tokens
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "poll-deploy-status: fails when token is missing" {
	run bash "${RAILWAY_SCRIPTS_DIR}/poll-deploy-status.sh"

	assert_failure
	assert_output --partial "RAILWAY_TOKEN or RAILWAY_API_TOKEN is required"
}

@test "poll-deploy-status: rejects invalid DEPLOY_POLL_INTERVAL" {
	run env \
		RAILWAY_TOKEN="test-token" \
		RAILWAY_DEPLOYMENT_ID="deploy-1" \
		DEPLOY_POLL_INTERVAL="0" \
		bash "${RAILWAY_SCRIPTS_DIR}/poll-deploy-status.sh"

	assert_failure
	assert_output --partial "DEPLOY_POLL_INTERVAL must be a positive integer"
}

@test "poll-deploy-status: exits 0 when deployment succeeds" {
	mock_command_script "curl" '
payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done
echo "{\"data\":{\"deployment\":{\"status\":\"SUCCESS\"}}}"
'

	run env \
		PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" \
		RAILWAY_TOKEN="test-token" \
		RAILWAY_DEPLOYMENT_ID="deploy-1" \
		DEPLOY_POLL_TIMEOUT="30" \
		DEPLOY_POLL_INTERVAL="1" \
		bash "${RAILWAY_SCRIPTS_DIR}/poll-deploy-status.sh"

	assert_success
	assert_output --partial "Deployment succeeded"
}

@test "poll-deploy-status: exits 1 when deployment fails" {
	mock_command_script "curl" '
payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done
echo "{\"data\":{\"deployment\":{\"status\":\"FAILED\"}}}"
'

	run env \
		PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" \
		RAILWAY_TOKEN="test-token" \
		RAILWAY_DEPLOYMENT_ID="deploy-1" \
		DEPLOY_POLL_TIMEOUT="30" \
		DEPLOY_POLL_INTERVAL="1" \
		bash "${RAILWAY_SCRIPTS_DIR}/poll-deploy-status.sh"

	assert_failure
	assert_output --partial "Deployment FAILED"
}

@test "poll-deploy-status: times out when status never completes" {
	mock_command_script "curl" '
payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done
echo "{\"data\":{\"deployment\":{\"status\":\"BUILDING\"}}}"
'

	run env \
		PATH="${BATS_TEST_TMPDIR}/bin:${PATH}" \
		RAILWAY_TOKEN="test-token" \
		RAILWAY_DEPLOYMENT_ID="deploy-1" \
		DEPLOY_POLL_TIMEOUT="2" \
		DEPLOY_POLL_INTERVAL="1" \
		bash "${RAILWAY_SCRIPTS_DIR}/poll-deploy-status.sh"

	assert_failure
	assert_output --partial "Timeout after 2s"
}
