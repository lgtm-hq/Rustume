#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/release/reconcile-releases.sh (#698)

bats_require_minimum_version 1.5.0

load "../../helpers/common"
load "../../helpers/mocks"

SCRIPT="${PROJECT_ROOT}/scripts/ci/release/reconcile-releases.sh"

setup() {
	setup_temp_dir
	export SCRIPT
	export GITHUB_STEP_SUMMARY="${BATS_TEST_TMPDIR}/step_summary"
	: >"${GITHUB_STEP_SUMMARY}"
	unset TAGS MAX_TAGS || true
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export IMAGE_REF=ghcr.io/lgtm-hq/rustume
}

teardown() {
	teardown_temp_dir
}

mock_registry() {
	local present="$1"
	local present_file="${BATS_TEST_TMPDIR}/present"
	printf '%s\n' "${present}" >"${present_file}"
	mock_command_script "curl" '
present_file="'"${present_file}"'"
url="${@: -1}"
if [[ "$url" == *"/token?"* ]]; then printf "{\"token\":\"tok\"}\n"; exit 0; fi
tag="${url##*/manifests/}"
if grep -qxF "$tag" "$present_file"; then printf "200"; else printf "404"; fi
'
}

mock_releases() {
	local present="$1"
	local present_file="${BATS_TEST_TMPDIR}/releases"
	printf '%s\n' "${present}" >"${present_file}"
	mock_command_script "gh" '
present_file="'"${present_file}"'"
tag=""
for arg in "$@"; do
	if [[ "$arg" == v* ]]; then tag="$arg"; fi
done
if grep -qxF "$tag" "$present_file"; then exit 0; fi
exit 1
'
}

@test "--help exits zero and documents the contract" {
	run bash "${SCRIPT}" --help
	assert_success
	assert_output --partial "Reconcile v* git tags"
}

@test "passes when every tag has a release and an image" {
	mock_registry "0.52.1"
	mock_releases "v0.52.1"
	export TAGS=v0.52.1

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "release present: v0.52.1"
	assert_output --partial "image present:"
}

@test "fails when the GitHub Release is missing" {
	mock_registry "0.52.5"
	mock_releases ""
	export TAGS=v0.52.5

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "release MISSING: v0.52.5"
	assert_output --partial "Missing GitHub Release"
}

@test "fails when the GHCR image is missing" {
	mock_registry ""
	mock_releases "v0.52.3"
	export TAGS=v0.52.3

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "image MISSING:"
	assert_output --partial "Missing GHCR image"
}

@test "refuses to run without GITHUB_REPOSITORY" {
	unset GITHUB_REPOSITORY
	export TAGS=v0.1.0

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "GITHUB_REPOSITORY is required"
}
