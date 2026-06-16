#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/railway/update-github-deployment-status.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
	export GITHUB_REPOSITORY="lgtm-hq/Rustume"
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "update-github-deployment-status: posts success status with environment URL" {
	mock_command_script "gh" '
if [[ "$1" == "api" ]]; then
  echo "ok"
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
'

	run env \
		DEPLOY_ID="99" \
		DEPLOY_STATE="success" \
		DEPLOY_ENVIRONMENT_URL="https://app.rustume.com" \
		DEPLOY_DESCRIPTION="Deployed to Railway" \
		bash "${RAILWAY_SCRIPTS_DIR}/update-github-deployment-status.sh"

	assert_success
	assert_output --partial "ok"
}

@test "update-github-deployment-status: fails when DEPLOY_ID is missing" {
	run env DEPLOY_STATE="failure" bash "${RAILWAY_SCRIPTS_DIR}/update-github-deployment-status.sh"

	assert_failure
	assert_output --partial "DEPLOY_ID is required"
}
