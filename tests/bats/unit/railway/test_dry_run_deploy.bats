#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/railway/dry-run-deploy.sh

load "../../helpers/common"

setup() {
	setup_temp_dir
	clear_railway_tokens
}

teardown() {
	teardown_temp_dir
}

@test "dry-run-deploy: prints planned deploy details" {
	run env \
		RAILWAY_IMAGE="ghcr.io/lgtm-hq/rustume:main" \
		RAILWAY_SERVICE_ID="service-123" \
		RAILWAY_ENVIRONMENT_ID="env-456" \
		RAILWAY_PROJECT_ID="project-789" \
		bash "${RAILWAY_SCRIPTS_DIR}/dry-run-deploy.sh"

	assert_success
	assert_output --partial "DRY RUN"
	assert_output --partial "ghcr.io/lgtm-hq/rustume:main"
	assert_output --partial "service-123"
}

@test "dry-run-deploy: fails when RAILWAY_IMAGE is missing" {
	run bash "${RAILWAY_SCRIPTS_DIR}/dry-run-deploy.sh"

	assert_failure
	assert_output --partial "RAILWAY_IMAGE is required"
}
