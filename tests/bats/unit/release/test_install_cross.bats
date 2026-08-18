#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/release/install-cross.sh idempotency (#885)

bats_require_minimum_version 1.5.0

load "../../helpers/common"

SCRIPT="scripts/ci/release/install-cross.sh"

setup() {
	setup_temp_dir
	STUB_BIN="${BATS_TEST_TMPDIR}/stubbin"
	mkdir -p "${STUB_BIN}"
	for tool in bash env head; do
		if command -v "${tool}" >/dev/null 2>&1; then
			ln -sf "$(command -v "${tool}")" "${STUB_BIN}/${tool}"
		fi
	done
	CARGO_STUB_LOG="${BATS_TEST_TMPDIR}/cargo.log"
	export CARGO_STUB_LOG
}

# Writes a cargo stub that records its invocations and always succeeds.
_write_cargo_stub() {
	cat >"${STUB_BIN}/cargo" <<-'EOF'
		#!/usr/bin/env bash
		echo "cargo $*" >>"${CARGO_STUB_LOG}"
	EOF
	chmod +x "${STUB_BIN}/cargo"
}

# Writes a cross stub so `command -v cross` succeeds.
_write_cross_stub() {
	cat >"${STUB_BIN}/cross" <<-'EOF'
		#!/usr/bin/env bash
		echo "cross 0.0.0-stub"
	EOF
	chmod +x "${STUB_BIN}/cross"
}

@test "skips cargo install when cross is already on PATH" {
	_write_cargo_stub
	_write_cross_stub
	PATH="${STUB_BIN}" run -0 bash "${SCRIPT}"
	[[ "${output}" == *"already installed"* ]]
	[[ ! -s "${CARGO_STUB_LOG}" ]]
}

@test "installs cross via cargo when absent" {
	_write_cargo_stub
	PATH="${STUB_BIN}" run -0 bash "${SCRIPT}"
	grep -q "install cross --locked" "${CARGO_STUB_LOG}"
}

@test "propagates cargo install failure" {
	cat >"${STUB_BIN}/cargo" <<-'EOF'
		#!/usr/bin/env bash
		exit 101
	EOF
	chmod +x "${STUB_BIN}/cargo"
	PATH="${STUB_BIN}" run ! bash "${SCRIPT}"
}
