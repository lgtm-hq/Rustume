#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/boundary/check_paths.sh

load "../../helpers/common"

CHECK_PATHS="${PROJECT_ROOT}/scripts/ci/boundary/check_paths.sh"

setup() {
	TMP_REPO="${BATS_TEST_TMPDIR}/repo"
	mkdir -p "${TMP_REPO}"
	git -C "${TMP_REPO}" init -q
}

run_guard() {
	cd "${TMP_REPO}"
	run bash "${CHECK_PATHS}"
}

@test "boundary paths: clean tree passes" {
	echo "fn main() {}" >"${TMP_REPO}/main.rs"
	git -C "${TMP_REPO}" add main.rs

	run_guard

	assert_success
	assert_output --partial "Boundary path guard passed"
}

@test "boundary paths: tracked .tf file fails and is listed" {
	echo 'resource "x" "y" {}' >"${TMP_REPO}/main.tf"
	git -C "${TMP_REPO}" add main.tf

	run_guard

	assert_failure
	assert_output --partial "Ops-boundary violation"
	assert_output --partial "main.tf"
}

@test "boundary paths: tfvars and lockfile fail" {
	mkdir -p "${TMP_REPO}/env"
	echo 'foo = "bar"' >"${TMP_REPO}/env/production.tfvars"
	touch "${TMP_REPO}/.terraform.lock.hcl"
	git -C "${TMP_REPO}" add env/production.tfvars .terraform.lock.hcl

	run_guard

	assert_failure
	assert_output --partial "env/production.tfvars"
	assert_output --partial ".terraform.lock.hcl"
}

@test "boundary paths: nested infra directory fails" {
	mkdir -p "${TMP_REPO}/deploy/infra/modules"
	echo "x" >"${TMP_REPO}/deploy/infra/modules/main.txt"
	git -C "${TMP_REPO}" add deploy/infra/modules/main.txt

	run_guard

	assert_failure
	assert_output --partial "deploy/infra/modules/main.txt"
}

@test "boundary paths: runbook document fails" {
	mkdir -p "${TMP_REPO}/docs"
	echo "# Incident runbook" >"${TMP_REPO}/docs/incident-runbook.md"
	git -C "${TMP_REPO}" add docs/incident-runbook.md

	run_guard

	assert_failure
	assert_output --partial "docs/incident-runbook.md"
}

@test "boundary paths: allowlisted file passes with justification" {
	echo 'foo = "bar"' >"${TMP_REPO}/example.tfvars"
	{
		echo "# allowlist"
		echo "example.tfvars  # illustrative example, no real topology"
	} >"${TMP_REPO}/.boundary-allowlist"
	git -C "${TMP_REPO}" add example.tfvars .boundary-allowlist

	run_guard

	assert_success
	assert_output --partial "Boundary path guard passed"
}
