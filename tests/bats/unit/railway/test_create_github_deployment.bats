#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/railway/create-github-deployment.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
	export GITHUB_OUTPUT="${BATS_TEST_TMPDIR}/github_output"
	export GITHUB_REPOSITORY="lgtm-hq/Rustume"
	touch "${GITHUB_OUTPUT}"
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "create-github-deployment: writes deployment id to GITHUB_OUTPUT" {
	mock_command_script "gh" '
if [[ "$1" == "api" ]]; then
  echo "424242"
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
'

	run env \
		DEPLOY_REF="abc123def456" \
		bash "${RAILWAY_SCRIPTS_DIR}/create-github-deployment.sh"

	assert_success
	assert_equal "424242" "$(get_github_output id)"
}

@test "create-github-deployment: fails when DEPLOY_REF is missing" {
	run bash "${RAILWAY_SCRIPTS_DIR}/create-github-deployment.sh"

	assert_failure
	assert_output --partial "DEPLOY_REF is required"
}
