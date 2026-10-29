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
	unset TAGS MAX_TAGS MIN_TAG_AGE_SECONDS GIT_DIR GIT_WORK_TREE || true
	export GITHUB_REPOSITORY=lgtm-hq/Rustume
	export IMAGE_REF=ghcr.io/lgtm-hq/rustume
	export ALLOWLIST_FILE="${BATS_TEST_TMPDIR}/allowlist.txt"
	: >"${ALLOWLIST_FILE}"
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

@test "reviewed superseded gap is acknowledged in output and summary" {
	mock_registry ""
	mock_releases ""
	export TAGS=v0.69.5
	# The default file must resolve relative to the script, even outside the repo.
	unset ALLOWLIST_FILE
	cd "${BATS_TEST_TMPDIR}"

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "Acknowledged superseded release gap: v0.69.5"
	assert_output --partial "All 0 tag(s)"
	run cat "${GITHUB_STEP_SUMMARY}"
	assert_output --partial "Acknowledged superseded release gap: v0.69.5"
	assert_output --partial "acknowledged gaps=1"
}

@test "acknowledging one tag does not hide an unlisted missing release" {
	mock_registry "0.69.6"
	mock_releases ""
	printf '  # reviewed gap\n\nv0.69.5 # superseded\n' >"${ALLOWLIST_FILE}"
	export TAGS="v0.69.5 v0.69.6"

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Acknowledged superseded release gap: v0.69.5"
	assert_output --partial "release MISSING: v0.69.6"
}

@test "acknowledging one tag does not hide an unlisted missing image" {
	mock_registry ""
	mock_releases "v0.69.6"
	printf 'v0.69.5 # superseded' >"${ALLOWLIST_FILE}"
	export TAGS="v0.69.5 v0.69.6"

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Acknowledged superseded release gap: v0.69.5"
	assert_output --partial "Missing GHCR image(s): ghcr.io/lgtm-hq/rustume:0.69.6"
}

@test "empty allow-list still fails for the known missing version" {
	mock_registry ""
	mock_releases ""
	export TAGS=v0.69.5

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "release MISSING: v0.69.5"
	assert_output --partial "Missing GHCR image(s): ghcr.io/lgtm-hq/rustume:0.69.5"
}

@test "allow-list rejects patterns rather than silently matching new gaps" {
	printf 'v0.69.* # too broad\n' >"${ALLOWLIST_FILE}"
	export TAGS=v0.69.6

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Invalid release reconciliation allow-list entry"
}

@test "missing allow-list fails closed" {
	export ALLOWLIST_FILE="${BATS_TEST_TMPDIR}/missing.txt"
	export TAGS=v0.69.5

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "Cannot read release reconciliation allow-list"
}

@test "reconcile workflow does not fire on tag push" {
	local workflow="${PROJECT_ROOT}/.github/workflows/reconcile-releases.yml"
	run grep -n "tags:" "${workflow}"
	assert_failure
}

seed_version_tag_repo() {
	# CI PR checkouts are often tagless; the listing path must not depend on
	# whatever tags happen to exist in the runner clone.
	local repo="${BATS_TEST_TMPDIR}/tag-repo"
	mkdir -p "${repo}"
	git -C "${repo}" init -q
	git -C "${repo}" config user.email "test@example.com"
	git -C "${repo}" config user.name "test"
	printf 'x\n' >"${repo}/file"
	git -C "${repo}" add file
	git -C "${repo}" -c commit.gpgsign=false commit -qm init
	git -C "${repo}" tag v0.1.0
	export GIT_DIR="${repo}/.git"
	export GIT_WORK_TREE="${repo}"
}

@test "scheduled listing skips tags younger than MIN_TAG_AGE_SECONDS" {
	mock_registry "0.1.0"
	mock_releases "v0.1.0"
	unset TAGS
	export MIN_TAG_AGE_SECONDS=999999999
	export MAX_TAGS=5
	seed_version_tag_repo

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "skip young tag:"
	assert_output --partial "nothing to reconcile"
}

@test "scheduled listing uses tagger date not the pointed-to commit date" {
	mock_registry "0.1.0"
	mock_releases "v0.1.0"
	unset TAGS
	export MIN_TAG_AGE_SECONDS=7200
	export MAX_TAGS=5

	local repo="${BATS_TEST_TMPDIR}/tag-repo"
	mkdir -p "${repo}"
	git -C "${repo}" init -q
	git -C "${repo}" config user.email "test@example.com"
	git -C "${repo}" config user.name "test"
	printf 'x\n' >"${repo}/file"
	git -C "${repo}" add file
	GIT_AUTHOR_DATE="2000-01-01T00:00:00Z" \
		GIT_COMMITTER_DATE="2000-01-01T00:00:00Z" \
		git -C "${repo}" -c commit.gpgsign=false commit -qm init
	# Tag created now, pointing at a 26-year-old commit.
	git -C "${repo}" -c commit.gpgsign=false tag -a v0.1.0 -m "Release v0.1.0"
	export GIT_DIR="${repo}/.git"
	export GIT_WORK_TREE="${repo}"

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "skip young tag:"
	assert_output --partial "nothing to reconcile"
}

@test "explicit TAGS are not age-filtered by default" {
	mock_registry "0.52.1"
	mock_releases "v0.52.1"
	export TAGS=v0.52.1
	unset MIN_TAG_AGE_SECONDS

	run bash "${SCRIPT}"
	assert_success
	assert_output --partial "release present: v0.52.1"
	[[ "${output}" != *"skip young tag"* ]] ||
		fail "explicit TAGS must not apply the scheduled grace period"
}

@test "release shell workflow documents pull-requests write" {
	local workflow="${PROJECT_ROOT}/.github/workflows/test-release-shell.yml"
	run grep -E 'pull-requests: write # publish-test-summary posts shell coverage on PRs' \
		"${workflow}"
	assert_success
}

@test "refuses to run without GITHUB_REPOSITORY" {
	unset GITHUB_REPOSITORY
	export TAGS=v0.1.0

	run bash "${SCRIPT}"
	assert_failure
	assert_output --partial "GITHUB_REPOSITORY is required"
}
