#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/docker/install-cargo-binstall.sh

load "../../helpers/common"
load "../../helpers/mocks"

SCRIPT="${PROJECT_ROOT}/scripts/ci/docker/install-cargo-binstall.sh"

setup() {
	setup_temp_dir
	save_path
	export CARGO_HOME="${BATS_TEST_TMPDIR}/cargo"
	export HOME="${BATS_TEST_TMPDIR}/home"
	export SHA_ARGS_FILE="${BATS_TEST_TMPDIR}/sha-args"
	unset TARGETARCH BINSTALL_VERSION BINSTALL_SHA256 || true

	mock_command "uname" "x86_64"
	mock_command "cargo-binstall" "cargo-binstall 0.0.0"
	mock_command_script "curl" '
while (($#)); do
	if [[ "$1" == "--output" ]]; then
		shift
		mkdir -p "$(dirname "$1")"
		: >"$1"
		exit 0
	fi
	shift
done
exit 2
'
	mock_command_script "tar" '
destination=""
while (($#)); do
	case "$1" in
	-C)
		destination="$2"
		shift 2
		;;
	*)
		shift
		;;
	esac
done
cat >"${destination}/cargo-binstall" <<'"'"'SCRIPT'"'"'
#!/usr/bin/env bash
printf "cargo-binstall 1.21.1\n"
SCRIPT
chmod +x "${destination}/cargo-binstall"
'
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "Docker-style TARGETARCH invocation verifies the archive portably" {
	mock_command_script "sha256sum" '
printf "%s\n" "$*" >"${SHA_ARGS_FILE}"
cat >/dev/null
exit 0
'

	run env CARGO_HOME="${CARGO_HOME}" HOME="${HOME}" TARGETARCH=amd64 \
		bash "${SCRIPT}"

	assert_success
	assert_output --partial "Installed cargo-binstall 1.21.1"
	[[ -x "${CARGO_HOME}/bin/cargo-binstall" ]]
	run cat "${SHA_ARGS_FILE}"
	assert_output "-c -"
}

@test "checksum mismatch fails before extracting or installing" {
	export TAR_CALLED_FILE="${BATS_TEST_TMPDIR}/tar-called"
	mock_command_script "sha256sum" '
cat >/dev/null
exit 1
'
	mock_command_script "tar" '
: >"${TAR_CALLED_FILE}"
exit 99
'

	run env CARGO_HOME="${CARGO_HOME}" HOME="${HOME}" TARGETARCH=arm64 \
		TAR_CALLED_FILE="${TAR_CALLED_FILE}" bash "${SCRIPT}"

	assert_failure
	[[ ! -e "${TAR_CALLED_FILE}" ]]
	[[ ! -e "${CARGO_HOME}/bin/cargo-binstall" ]]
}

@test "version override without checksum fails closed" {
	run env CARGO_HOME="${CARGO_HOME}" HOME="${HOME}" \
		BINSTALL_VERSION=9.9.9 bash "${SCRIPT}"

	assert_failure
	assert_output --partial "set BINSTALL_SHA256"
}
