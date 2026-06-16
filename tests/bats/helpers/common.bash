#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Common utilities for Rustume BATS tests.

HELPERS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${HELPERS_DIR}/../../.." && pwd)"
export PROJECT_ROOT
export RAILWAY_SCRIPTS_DIR="${PROJECT_ROOT}/scripts/ci/railway"

_load_bats_library() {
	local name="$1"
	local paths=(
		"${BATS_TEST_DIRNAME}/../../node_modules/bats-${name}/load.bash"
		"/opt/homebrew/lib/bats-${name}/load.bash"
		"/usr/local/lib/bats-${name}/load.bash"
		"/usr/lib/bats-${name}/load.bash"
	)

	for path in "${paths[@]}"; do
		if [[ -f "${path}" ]]; then
			# shellcheck disable=SC1090
			source "${path}"
			return 0
		fi
	done

	return 1
}

if ! _load_bats_library "support"; then
	fail() {
		echo "# $*" >&2
		return 1
	}
fi

if ! _load_bats_library "assert"; then
	# status and output are set by BATS run()
	# shellcheck disable=SC2154
	assert_success() {
		[[ "${status}" -eq 0 ]] || {
			echo "# Expected success, got exit ${status}" >&2
			echo "# Output: ${output}" >&2
			return 1
		}
	}

	# shellcheck disable=SC2154
	assert_failure() {
		[[ "${status}" -ne 0 ]] || {
			echo "# Expected failure, got exit 0" >&2
			echo "# Output: ${output}" >&2
			return 1
		}
	}

	# shellcheck disable=SC2154
	assert_output() {
		local expected
		if [[ "$1" == "--partial" ]]; then
			expected="$2"
			[[ "${output}" == *"${expected}"* ]] || {
				echo "# Expected output to contain: ${expected}" >&2
				echo "# Actual output: ${output}" >&2
				return 1
			}
		else
			expected="$1"
			[[ "${output}" == "${expected}" ]] || {
				echo "# Expected output: ${expected}" >&2
				echo "# Actual output: ${output}" >&2
				return 1
			}
		fi
	}

	assert_equal() {
		[[ "$1" == "$2" ]] || {
			echo "# Expected: $1" >&2
			echo "# Actual:   $2" >&2
			return 1
		}
	}
fi

setup_temp_dir() {
	if [[ -z "${BATS_TEST_TMPDIR:-}" ]]; then
		export BATS_TEST_TMPDIR="$(mktemp -d "${TMPDIR:-/tmp}/bats-test.XXXXXXXXXX")"
	fi
}

teardown_temp_dir() {
	if [[ -n "${BATS_TEST_TMPDIR:-}" ]] && [[ -d "${BATS_TEST_TMPDIR}" ]]; then
		rm -rf "${BATS_TEST_TMPDIR}"
	fi
}

get_github_output() {
	local key="$1"
	grep -m1 "^${key}=" "${GITHUB_OUTPUT}" | cut -d= -f2-
}

clear_railway_tokens() {
	unset RAILWAY_TOKEN RAILWAY_API_TOKEN
}
