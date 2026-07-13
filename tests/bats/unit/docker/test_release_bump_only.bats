#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/docker/release_bump_only.sh (#457)

load "../../helpers/common"

SCRIPT="scripts/ci/docker/release_bump_only.sh"

setup() {
	setup_temp_dir
	REPO="${BATS_TEST_TMPDIR}/repo"
	mkdir -p "${REPO}"
	git -C "${REPO}" init -q
	git -C "${REPO}" config user.email "test@example.com"
	git -C "${REPO}" config user.name "test"
	cat >"${REPO}/Cargo.toml" <<-'EOF'
		[package]
		name = "rustume"
		version = "0.29.0"
	EOF
	cat >"${REPO}/Cargo.lock" <<-'EOF'
		[[package]]
		name = "rustume"
		version = "0.29.0"

		[[package]]
		name = "serde"
		version = "1.0.22"
		checksum = "aaaa"
	EOF
	echo "# Changelog" >"${REPO}/CHANGELOG.md"
	echo "fn main() {}" >"${REPO}/main.rs"
	git -C "${REPO}" add -A
	git -C "${REPO}" commit -qm "init"
	BASE="$(git -C "${REPO}" rev-parse HEAD)"
}

teardown() {
	teardown_temp_dir
}

run_script() {
	(cd "${REPO}" && bash "${PROJECT_ROOT}/${SCRIPT}" "$@")
}

commit_all() {
	git -C "${REPO}" add -A
	git -C "${REPO}" commit -qm "$1"
	HEAD_SHA="$(git -C "${REPO}" rev-parse HEAD)"
}

@test "pure version bump classifies true" {
	sed -i.bak 's/0\.29\.0/0.29.1/' "${REPO}/Cargo.toml" "${REPO}/Cargo.lock"
	rm -f "${REPO}"/*.bak
	echo "## 0.29.1" >>"${REPO}/CHANGELOG.md"
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[ "${output}" = "true" ]
}

@test "bump that also updates a dependency classifies false" {
	sed -i.bak 's/0\.29\.0/0.29.1/' "${REPO}/Cargo.toml" "${REPO}/Cargo.lock"
	sed -i.bak -e 's/1\.0\.22/1.0.23/' -e 's/aaaa/bbbb/' "${REPO}/Cargo.lock"
	rm -f "${REPO}"/*.bak
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[[ "${output}" == *"false"* ]]
}

@test "code change outside allowlist classifies false" {
	sed -i.bak 's/0\.29\.0/0.29.1/' "${REPO}/Cargo.toml" "${REPO}/Cargo.lock"
	rm -f "${REPO}"/*.bak
	echo "fn extra() {}" >>"${REPO}/main.rs"
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[[ "${output}" == *"false"* ]]
}

@test "changelog-only change classifies true" {
	echo "## notes" >>"${REPO}/CHANGELOG.md"
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[ "${output}" = "true" ]
}

@test "external dep version-only change (checksum untouched) classifies false" {
	# Greptile P1 on #469: a diff touching only version lines must not pass
	# when the changed package is external (has a checksum).
	sed -i.bak 's/1\.0\.22/1.0.23/' "${REPO}/Cargo.lock"
	rm -f "${REPO}"/*.bak
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[[ "${output}" == *"false"* ]]
}

@test "package added to Cargo.lock classifies false" {
	cat >>"${REPO}/Cargo.lock" <<-'EOF'

		[[package]]
		name = "newdep"
		version = "0.1.0"
		checksum = "cccc"
	EOF
	commit_all "chore(release): version 0.29.1"
	run run_script "${BASE}" "${HEAD_SHA}"
	[ "${status}" -eq 0 ]
	[[ "${output}" == *"false"* ]]
}

@test "all-zero base sha classifies false" {
	run run_script "0000000000000000000000000000000000000000" "${BASE}"
	[ "${status}" -eq 0 ]
	[ "${output}" = "false" ]
}

@test "empty diff classifies false" {
	run run_script "${BASE}" "${BASE}"
	[ "${status}" -eq 0 ]
	[ "${output}" = "false" ]
}

@test "missing arguments exits 2" {
	run run_script "${BASE}"
	[ "${status}" -eq 2 ]
}
