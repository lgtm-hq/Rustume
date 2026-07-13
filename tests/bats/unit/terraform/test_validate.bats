#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/terraform/validate.sh

load "../../helpers/common"

@test "terraform validate: --help not required, script runs fmt check" {
	run bash "${PROJECT_ROOT}/scripts/ci/terraform/validate.sh"

	if [[ "${status}" -eq 0 ]]; then
		assert_output --partial "Terraform fmt and validate passed."
	else
		assert_failure
		assert_output --partial "terraform"
	fi
}
