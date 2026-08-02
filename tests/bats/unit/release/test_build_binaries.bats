#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/release/build-binaries.sh PATH recovery (#702)

bats_require_minimum_version 1.5.0

load "../../helpers/common"

SCRIPT="scripts/ci/release/build-binaries.sh"

setup() {
	setup_temp_dir
	# Isolate PATH so the host's real cargo cannot satisfy the lookup and mask
	# the behaviour under test.
	STUB_BIN="${BATS_TEST_TMPDIR}/stubbin"
	FAKE_CARGO_HOME="${BATS_TEST_TMPDIR}/cargohome"
	mkdir -p "${STUB_BIN}" "${FAKE_CARGO_HOME}/bin"
	for tool in bash env uname dirname basename; do
		if command -v "${tool}" >/dev/null 2>&1; then
			ln -sf "$(command -v "${tool}")" "${STUB_BIN}/${tool}"
		fi
	done
	MINIMAL_PATH="${STUB_BIN}"
}

# Writes a cargo stub that records its invocations and always succeeds.
_write_cargo_stub() {
	local dest="$1"
	cat >"${dest}" <<-'EOF'
		#!/usr/bin/env bash
		if [[ "${1:-}" == "--version" ]]; then
			echo "cargo 1.0.0-stub"
			exit 0
		fi
		echo "cargo $*" >>"${CARGO_STUB_LOG}"
	EOF
	chmod +x "${dest}"
}

@test "fails clearly when cargo is absent from PATH and CARGO_HOME" {
	run env PATH="${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		TARGET=x86_64-apple-darwin \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_failure
	[[ "${output}" == *"cargo not found on PATH"* ]] || {
		echo "# expected a named cargo-not-found error, got: ${output}" >&2
		return 1
	}
	# The failure must name the toolchain, not just die on a bare
	# "command not found" from the build line.
	[[ "${output}" == *"did not produce a usable cargo"* ]] || {
		echo "# expected the toolchain to be named as the cause, got: ${output}" >&2
		return 1
	}
}

@test "recovers cargo from CARGO_HOME/bin when setup left it off PATH" {
	_write_cargo_stub "${FAKE_CARGO_HOME}/bin/cargo"
	local log="${BATS_TEST_TMPDIR}/cargo.log"

	run env PATH="${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		CARGO_STUB_LOG="${log}" TARGET=x86_64-apple-darwin \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_success
	[[ "${output}" == *"adding ${FAKE_CARGO_HOME}/bin"* ]] || {
		echo "# expected the PATH recovery to be announced, got: ${output}" >&2
		return 1
	}
	# Both crates must still be built after recovery.
	grep -q -- "-p rustume-cli" "${log}"
	grep -q -- "-p rustume-server" "${log}"
	grep -q -- "--target x86_64-apple-darwin" "${log}"
}

@test "recovers cargo through rustup when CARGO_HOME/bin has no shims (#774)" {
	# macos-15-intel: rustup resolves but cargo shims never land in
	# CARGO_HOME/bin. The script must ask rustup where cargo lives.
	local rustup_dir="${BATS_TEST_TMPDIR}/rustupbin"
	local toolchain_bin="${BATS_TEST_TMPDIR}/toolchain/bin"
	mkdir -p "${rustup_dir}" "${toolchain_bin}"
	_write_cargo_stub "${toolchain_bin}/cargo"
	cat >"${rustup_dir}/rustup" <<-EOF
		#!/usr/bin/env bash
		if [[ "\${1:-}" == "which" ]]; then
			echo "${toolchain_bin}/cargo"
			exit 0
		fi
		exit 0
	EOF
	chmod +x "${rustup_dir}/rustup"
	local log="${BATS_TEST_TMPDIR}/cargo-rustup.log"

	run env PATH="${rustup_dir}:${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		CARGO_STUB_LOG="${log}" TARGET=x86_64-apple-darwin \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_success
	[[ "${output}" == *"using ${toolchain_bin} via rustup"* ]] || {
		echo "# expected the rustup recovery to be announced, got: ${output}" >&2
		return 1
	}
	grep -q -- "-p rustume-cli" "${log}"
	grep -q -- "--target x86_64-apple-darwin" "${log}"
}

@test "installs stable through rustup when no toolchain is present (#774)" {
	# rustup exists but `rustup which cargo` fails until a toolchain is
	# installed — the script must install stable, then retry.
	local rustup_dir="${BATS_TEST_TMPDIR}/rustupbin2"
	local toolchain_bin="${BATS_TEST_TMPDIR}/toolchain2/bin"
	local marker="${BATS_TEST_TMPDIR}/installed"
	mkdir -p "${rustup_dir}" "${toolchain_bin}"
	_write_cargo_stub "${toolchain_bin}/cargo"
	cat >"${rustup_dir}/rustup" <<-EOF
		#!/usr/bin/env bash
		case "\${1:-}" in
		which)
			if [[ -f "${marker}" ]]; then
				echo "${toolchain_bin}/cargo"
				exit 0
			fi
			exit 1
			;;
		toolchain)
			# Enforce the exact install contract the script promises.
			if [[ "\$*" == "toolchain install stable --profile minimal" ]]; then
				: >"${marker}"
				exit 0
			fi
			echo "unexpected rustup toolchain args: \$*" >&2
			exit 1
			;;
		esac
		exit 0
	EOF
	chmod +x "${rustup_dir}/rustup"
	local log="${BATS_TEST_TMPDIR}/cargo-install.log"

	run env PATH="${rustup_dir}:${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		CARGO_STUB_LOG="${log}" TARGET=x86_64-apple-darwin \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_success
	[[ -f "${marker}" ]] || {
		echo "# expected rustup toolchain install to be invoked" >&2
		return 1
	}
	grep -q -- "-p rustume-server" "${log}"
}

@test "cross does not trigger the rustup recovery" {
	# A rustup that would resolve cargo must not be consulted for cross —
	# cross is installed separately (cargo install cross --locked), never
	# provided by rustup. The stub records any invocation so a silent call
	# cannot hide behind the expected final error.
	local rustup_dir="${BATS_TEST_TMPDIR}/rustupbin3"
	local called="${BATS_TEST_TMPDIR}/rustup-called"
	mkdir -p "${rustup_dir}"
	cat >"${rustup_dir}/rustup" <<-EOF
		#!/usr/bin/env bash
		: >"${called}"
		echo "rustup should not be called for cross" >&2
		exit 1
	EOF
	chmod +x "${rustup_dir}/rustup"

	run env PATH="${rustup_dir}:${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		TARGET=aarch64-unknown-linux-gnu USE_CROSS=true \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_failure
	[[ "${output}" == *"cross not found on PATH"* ]]
	[[ ! -f "${called}" ]] || {
		echo "# rustup was invoked during a cross build" >&2
		return 1
	}
}

@test "defaults CARGO_HOME to ~/.cargo when unset" {
	local home="${BATS_TEST_TMPDIR}/home"
	mkdir -p "${home}/.cargo/bin"
	_write_cargo_stub "${home}/.cargo/bin/cargo"
	local log="${BATS_TEST_TMPDIR}/cargo-default.log"

	run env -u CARGO_HOME PATH="${MINIMAL_PATH}" HOME="${home}" \
		CARGO_STUB_LOG="${log}" TARGET=aarch64-apple-darwin \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_success
	grep -q -- "--target aarch64-apple-darwin" "${log}"
}

@test "uses cross without falling back to the cargo bin dir" {
	local cross_dir="${BATS_TEST_TMPDIR}/crossbin"
	mkdir -p "${cross_dir}"
	_write_cargo_stub "${cross_dir}/cross"
	local log="${BATS_TEST_TMPDIR}/cross.log"

	run env PATH="${cross_dir}:${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		CARGO_STUB_LOG="${log}" TARGET=aarch64-unknown-linux-gnu USE_CROSS=true \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_success
	grep -q -- "--target aarch64-unknown-linux-gnu" "${log}"
}

@test "still requires TARGET" {
	run env PATH="${MINIMAL_PATH}" CARGO_HOME="${FAKE_CARGO_HOME}" \
		bash "${PROJECT_ROOT}/${SCRIPT}"

	assert_failure
	[[ "${output}" == *"TARGET is required"* ]]
}
