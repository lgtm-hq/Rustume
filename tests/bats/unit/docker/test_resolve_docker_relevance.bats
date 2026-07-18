#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/docker/resolve_docker_relevance.sh (#476)

load "../../helpers/common"
load "../../helpers/mocks"

SCRIPT="${PROJECT_ROOT}/scripts/ci/docker/resolve_docker_relevance.sh"

setup() {
	setup_temp_dir
	export GITHUB_OUTPUT="${BATS_TEST_TMPDIR}/github_output"
	: >"${GITHUB_OUTPUT}"
}

teardown() {
	teardown_temp_dir
}

is_listed() {
	local needle="$1"
	shift
	local item
	for item in "$@"; do
		if [[ "${item}" == "${needle}" ]]; then
			return 0
		fi
	done
	return 1
}

# Every top-level path must be explicitly categorized as skip or must-build so
# new directories cannot silently fall through without a decision (#476 drift).
@test "resolve_docker_relevance: every top-level path is categorized" {
	local skip_roots=(docs)
	local skip_files=(
		CHANGELOG.md
		CONTRIBUTING.md
		LICENSING.md
		README.md
		SECURITY.md
	)
	local must_build=(
		.github
		apps
		bindings
		crates
		docker
		scripts
		tests
		Cargo.lock
		Cargo.toml
		LICENSE
		Makefile
		NOTICE
		THIRD_PARTY_NOTICES
		clippy.toml
		docker-compose.yml
		pyproject.toml
		renovate.json
		rustfmt.toml
		uv.lock
	)

	local missing=()
	local entry
	# Use the committed tree (not the working directory) so local build artifacts
	# like `target/` or `.venv/` cannot fail the drift check.
	while IFS= read -r entry; do
		[[ -z "${entry}" ]] && continue
		if [[ "${entry}" == .* && "${entry}" != ".github" ]]; then
			continue
		fi
		if is_listed "${entry}" "${skip_roots[@]}" ||
			is_listed "${entry}" "${skip_files[@]}" ||
			is_listed "${entry}" "${must_build[@]}"; then
			continue
		fi
		missing+=("${entry}")
	done < <(cd "${PROJECT_ROOT}" && git ls-tree --name-only HEAD)

	[[ "${#missing[@]}" -eq 0 ]] || {
		echo "# Uncategorized top-level paths: ${missing[*]}" >&2
		echo "# Add each to skip_roots, skip_files, or must_build in this test." >&2
		return 1
	}
}

@test "resolve_docker_relevance: --help exits successfully" {
	run bash "${SCRIPT}" --help

	assert_success
	assert_output --partial "Resolve Docker pipeline path relevance"
}

@test "resolve_docker_relevance: non-PR events always pipeline=true" {
	run env \
		EVENT_NAME="push" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash "${SCRIPT}"

	assert_success
	assert_equal "true" "$(get_github_output pipeline)"
}

@test "resolve_docker_relevance: docs-only PR skips pipeline" {
	run env \
		EVENT_NAME="pull_request" \
		BASE_SHA="deadbeef" \
		HEAD_SHA="cafebabe" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash -c '
			git() {
				if [[ "$1" == "diff" ]]; then
					printf "%s\n" "docs/rfcs/0001-e2e-encryption.md" "README.md"
					return 0
				fi
				command git "$@"
			}
			export -f git
			bash "'"${SCRIPT}"'"
		'

	assert_success
	assert_equal "false" "$(get_github_output pipeline)"
	assert_equal "docs-only change" "$(get_github_output skip-reason)"
}

@test "resolve_docker_relevance: code change keeps pipeline=true" {
	run env \
		EVENT_NAME="pull_request" \
		BASE_SHA="deadbeef" \
		HEAD_SHA="cafebabe" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash -c '
			git() {
				if [[ "$1" == "diff" ]]; then
					printf "%s\n" "docs/README.md" "crates/server/src/lib.rs"
					return 0
				fi
				command git "$@"
			}
			export -f git
			bash "'"${SCRIPT}"'"
		'

	assert_success
	assert_equal "true" "$(get_github_output pipeline)"
}

@test "resolve_docker_relevance: unavailable diff fails open" {
	run env \
		EVENT_NAME="pull_request" \
		GITHUB_OUTPUT="${GITHUB_OUTPUT}" \
		bash -c '
			git() {
				if [[ "$1" == "rev-parse" ]]; then
					return 1
				fi
				command git "$@"
			}
			export -f git
			bash "'"${SCRIPT}"'"
		'

	assert_success
	assert_equal "true" "$(get_github_output pipeline)"
}
