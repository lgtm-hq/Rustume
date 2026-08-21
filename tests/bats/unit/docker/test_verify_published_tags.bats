#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/docker/verify-published-tags.sh (#597)

# `run !` is a silent no-op below this version (BW02 = dead assertion).
bats_require_minimum_version 1.5.0

load "../../helpers/common"
load "../../helpers/mocks"

SCRIPT="${PROJECT_ROOT}/scripts/ci/docker/verify-published-tags.sh"

setup() {
	setup_temp_dir
	export SCRIPT
	export GITHUB_STEP_SUMMARY="${BATS_TEST_TMPDIR}/step_summary"
	: >"${GITHUB_STEP_SUMMARY}"
	# Never wait for real time in unit tests.
	mock_command_script "sleep" 'exit 0'
	unset TAGS EXPECT_PLATFORMS TIMEOUT_SECONDS WATCH_WORKFLOW || true
	unset POST_SUCCESS_TIMEOUT_SECONDS || true
	unset REGISTRY_USERNAME REGISTRY_PASSWORD || true
	export TIMEOUT_SECONDS=0
	export POLL_INTERVAL_SECONDS=0
}

teardown() {
	teardown_temp_dir
}

# A curl stand-in that answers the three request shapes the script makes:
# the registry token endpoint, a HEAD manifest probe, and a GET manifest body.
#
# $1 - space separated tags that resolve (HTTP 200); everything else 404s
# $2 - optional manifest JSON returned by the GET probe
mock_registry() {
	local present="$1"
	local manifest="${2:-}"
	local present_file="${BATS_TEST_TMPDIR}/present"
	local manifest_file="${BATS_TEST_TMPDIR}/manifest.json"
	printf '%s\n' "${present}" >"${present_file}"
	printf '%s\n' "${manifest}" >"${manifest_file}"

	mock_command_script "curl" '
url="${@: -1}"
if [[ "$url" == *"/token?"* ]]; then
	printf "{\"token\":\"tok\"}\n"
	exit 0
fi
tag="${url##*/manifests/}"
present="$(cat "'"${present_file}"'")"
found=1
for candidate in $present; do
	if [[ "$candidate" == "$tag" ]]; then found=0; fi
done
for arg in "$@"; do
	if [[ "$arg" == "-I" ]]; then
		if [[ $found -eq 0 ]]; then printf "200"; else printf "404"; fi
		exit 0
	fi
done
if [[ $found -ne 0 ]]; then exit 22; fi
cat "'"${manifest_file}"'"
'
}

multi_arch_manifest() {
	cat <<'JSON'
{
  "mediaType": "application/vnd.oci.image.index.v1+json",
  "manifests": [
    {"platform": {"os": "linux", "architecture": "amd64"}},
    {"platform": {"os": "unknown", "architecture": "unknown"}},
    {"platform": {"os": "linux", "architecture": "arm64"}},
    {"platform": {"os": "unknown", "architecture": "unknown"}}
  ]
}
JSON
}

single_arch_manifest() {
	cat <<'JSON'
{
  "mediaType": "application/vnd.oci.image.index.v1+json",
  "manifests": [
    {"platform": {"os": "linux", "architecture": "arm64"}},
    {"platform": {"os": "unknown", "architecture": "unknown"}}
  ]
}
JSON
}

# =============================================================================
# Tag derivation
# =============================================================================

@test "tag build verifies version, latest and sha- tags" {
	mock_registry "0.46.0 latest sha-abc1234"
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "present: ghcr.io/lgtm-hq/rustume:0.46.0"
	assert_output --partial "present: ghcr.io/lgtm-hq/rustume:latest"
	assert_output --partial "present: ghcr.io/lgtm-hq/rustume:sha-abc1234"
	assert_output --partial "All expected tags resolve"
}

@test "tag build derives the tag from refs/tags when GITHUB_REF_TYPE is unset" {
	mock_registry "0.46.0 latest sha-abc1234"
	export GITHUB_REF=refs/tags/v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "ghcr.io/lgtm-hq/rustume: 0.46.0 latest sha-abc1234"
}

@test "non-tag main build is scoped to :main and :sha- only" {
	mock_registry "main sha-abc1234"
	export GITHUB_REF_TYPE=branch GITHUB_REF_NAME=main
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "ghcr.io/lgtm-hq/rustume: main sha-abc1234"
	[[ "${output}" != *"latest"* ]] || fail "main build must not require :latest"
}

@test "explicit TAGS overrides ref derivation" {
	mock_registry "custom-a custom-b"
	export TAGS="custom-a custom-b"
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v9.9.9 GITHUB_SHA=deadbeef123

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "Verifying 2 tag(s)"
	[[ "${output}" != *"9.9.9"* ]] || fail "explicit TAGS must win"
}

# =============================================================================
# Missing-tag failure (the #597 regression)
# =============================================================================

@test "a skipped manifest merge fails the job loudly" {
	# Nothing published: exactly what a single dead platform produces.
	mock_registry ""
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	assert_equal "1" "${status}"
	assert_output --partial "::error::Release image verification failed"
	assert_output --partial "The image was NOT published"
	assert_output --partial "0.46.0 latest sha-abc1234"
}

@test "a partially published tag set still fails" {
	mock_registry "latest sha-abc1234"
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "MISSING: ghcr.io/lgtm-hq/rustume:0.46.0"
}

@test "failure is recorded in the step summary" {
	mock_registry ""
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	run cat "${GITHUB_STEP_SUMMARY}"
	assert_output --partial "Image verification failed"
}

@test "success is recorded in the step summary" {
	mock_registry "0.46.0 latest sha-abc1234"
	export GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.46.0
	export GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_success
	run cat "${GITHUB_STEP_SUMMARY}"
	assert_output --partial "Image verification passed"
}

# =============================================================================
# Platform assertions
# =============================================================================

@test "multi-arch manifest satisfies EXPECT_PLATFORMS" {
	mock_registry "latest" "$(multi_arch_manifest)"
	export TAGS=latest EXPECT_PLATFORMS="linux/amd64,linux/arm64"

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "All expected tags resolve"
}

@test "single-arch manifest under a multi-arch tag fails" {
	mock_registry "latest" "$(single_arch_manifest)"
	export TAGS=latest EXPECT_PLATFORMS="linux/amd64,linux/arm64"

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "is missing platform linux/amd64"
	assert_output --partial "did not ship"
}

@test "a manifest body that cannot be fetched fails cleanly" {
	# HEAD says the tag exists but the GET fails (auth expiry, timeout). The
	# script must report the platform verdict, not abort mid-run.
	mock_command_script "curl" '
url="${@: -1}"
if [[ "$url" == *"/token?"* ]]; then printf "{\"token\":\"tok\"}\n"; exit 0; fi
for arg in "$@"; do
	if [[ "$arg" == "-I" ]]; then printf "200"; exit 0; fi
done
exit 22
'
	export TAGS=latest EXPECT_PLATFORMS="linux/amd64"

	run bash "${SCRIPT}"
	assert_failure
	assert_equal "1" "${status}"
	assert_output --partial "is missing platform linux/amd64"
}

@test "attestation manifests are not treated as platforms" {
	mock_registry "latest" "$(multi_arch_manifest)"
	export TAGS=latest EXPECT_PLATFORMS="unknown/unknown"

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "is missing platform unknown/unknown"
}

# =============================================================================
# Polling and fail-fast
# =============================================================================

@test "a tag that appears on a later poll passes" {
	local counter="${BATS_TEST_TMPDIR}/calls"
	printf '0\n' >"${counter}"
	mock_command_script "curl" '
url="${@: -1}"
if [[ "$url" == *"/token?"* ]]; then printf "{\"token\":\"tok\"}\n"; exit 0; fi
count=$(cat "'"${counter}"'")
count=$((count + 1))
printf "%s\n" "$count" > "'"${counter}"'"
if [[ $count -le 1 ]]; then printf "404"; else printf "200"; fi
'
	export TAGS=latest TIMEOUT_SECONDS=60 POLL_INTERVAL_SECONDS=0

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "MISSING"
	assert_output --partial "All expected tags resolve"
}

@test "fail-fast when the watched build already concluded in failure" {
	mock_registry ""
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"v0.46.0","status":"completed","conclusion":"failure"}]}'
	export TAGS=latest TIMEOUT_SECONDS=9000 POLL_INTERVAL_SECONDS=0
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Stopped waiting: docker-build-publish.yml"
}

@test "an in-progress watched build does not trigger fail-fast" {
	mock_registry ""
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"v0.46.0","status":"in_progress","conclusion":null}]}'
	export TAGS=latest TIMEOUT_SECONDS=0 POLL_INTERVAL_SECONDS=0
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	[[ "${output}" != *"Stopped waiting"* ]] ||
		fail "in-progress build must not short-circuit the wait"
}

@test "a run on another ref does not trigger fail-fast" {
	# The release-bump commit is reachable from both main and the tag, so the
	# same head_sha has a main run that must be ignored.
	mock_registry ""
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"main","status":"completed","conclusion":"failure"}]}'
	export TAGS=latest TIMEOUT_SECONDS=0 POLL_INTERVAL_SECONDS=0
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	[[ "${output}" != *"Stopped waiting"* ]] ||
		fail "a run for a different ref must be ignored"
}

@test "a successful watched build does not trigger fail-fast" {
	mock_registry ""
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"v0.46.0","status":"completed","conclusion":"success"}]}'
	export TAGS=latest TIMEOUT_SECONDS=0 POLL_INTERVAL_SECONDS=0
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	[[ "${output}" != *"Stopped waiting"* ]] ||
		fail "a successful watched build must not short-circuit"
}

@test "a successful watched build shrinks the remaining poll budget" {
	mock_registry ""
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"v0.46.0","status":"completed","conclusion":"success"}]}'
	export TAGS=latest TIMEOUT_SECONDS=9000 POLL_INTERVAL_SECONDS=0
	export POST_SUCCESS_TIMEOUT_SECONDS=0
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Watched build succeeded; remaining poll budget 0s"
	[[ "${output}" != *"Stopped waiting"* ]] ||
		fail "success must shrink the budget, not fail-fast as a failed build"
}

@test "post-success budget is not clipped by the original timeout" {
	# TIMEOUT_SECONDS is already exhausted (0) when docker succeeds; the
	# remaining wait must still be POST_SUCCESS_TIMEOUT_SECONDS so a tag
	# that appears on the next probe is accepted.
	local counter="${BATS_TEST_TMPDIR}/calls"
	printf '0\n' >"${counter}"
	mock_command_script "curl" '
url="${@: -1}"
if [[ "$url" == *"/token?"* ]]; then printf "{\"token\":\"tok\"}\n"; exit 0; fi
count=$(cat "'"${counter}"'")
count=$((count + 1))
printf "%s\n" "$count" > "'"${counter}"'"
if [[ $count -le 1 ]]; then printf "404"; else printf "200"; fi
'
	mock_command "gh" '{"workflow_runs":[{"run_number":1,"head_branch":"v0.46.0","status":"completed","conclusion":"success"}]}'
	export TAGS=latest TIMEOUT_SECONDS=0 POLL_INTERVAL_SECONDS=0
	export POST_SUCCESS_TIMEOUT_SECONDS=1
	export WATCH_WORKFLOW=docker-build-publish.yml
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export GITHUB_REF_NAME=v0.46.0 GITHUB_SHA=abc1234567890

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "Watched build succeeded; remaining poll budget 1s"
	assert_output --partial "All expected tags resolve"
}

# =============================================================================
# Input handling
# =============================================================================

@test "--help exits zero and documents the contract" {
	run bash "${SCRIPT}" --help
	assert_success
	assert_output --partial "Verify that expected container tags resolve"
}

@test "a registry-less IMAGE_REF is rejected" {
	export IMAGE_REF=rustume TAGS=latest

	run bash "${SCRIPT}"
	assert_failure
	assert_equal "2" "${status}"
	assert_output --partial "IMAGE_REF must be"
}

@test "an empty tag list is rejected" {
	export TAGS=" "
	export GITHUB_REF_TYPE=branch GITHUB_REF_NAME="" GITHUB_SHA=""

	run bash "${SCRIPT}"
	assert_failure
	assert_equal "2" "${status}"
	assert_output --partial "No tags to verify"
}
