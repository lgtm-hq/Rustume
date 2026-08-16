#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/testing/web/install-wasm-pack.sh

load "../../helpers/common"
load "../../helpers/mocks"

SCRIPT="${PROJECT_ROOT}/scripts/ci/testing/web/install-wasm-pack.sh"

setup() {
	setup_temp_dir
	save_path
	export CARGO_HOME="${BATS_TEST_TMPDIR}/cargo"
	export HOME="${BATS_TEST_TMPDIR}/home"
	export SHA_ARGS_FILE="${BATS_TEST_TMPDIR}/sha-args"
	unset WASM_PACK_VERSION WASM_PACK_SHA256 || true

	mock_command "uname" "x86_64"
	mock_command "wasm-pack" "wasm-pack 0.0.0"
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
archive=""
destination=""
while (($#)); do
	case "$1" in
	-xzf)
		archive="$2"
		shift 2
		;;
	-C)
		destination="$2"
		shift 2
		;;
	*)
		shift
		;;
	esac
done
directory="$(basename "${archive}" .tar.gz)"
mkdir -p "${destination}/${directory}"
cat >"${destination}/${directory}/wasm-pack" <<'"'"'SCRIPT'"'"'
#!/usr/bin/env bash
printf "wasm-pack 0.15.0\n"
SCRIPT
chmod +x "${destination}/${directory}/wasm-pack"
'
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "Docker-style invocation creates CARGO_HOME bin and verifies the archive portably" {
	mock_command_script "sha256sum" '
printf "%s\n" "$*" >"${SHA_ARGS_FILE}"
cat >/dev/null
exit 0
'

	run env CARGO_HOME="${CARGO_HOME}" HOME="${HOME}" bash "${SCRIPT}"

	assert_success
	assert_output --partial "Installed wasm-pack 0.15.0"
	[[ -x "${CARGO_HOME}/bin/wasm-pack" ]]
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

	run env CARGO_HOME="${CARGO_HOME}" HOME="${HOME}" \
		TAR_CALLED_FILE="${TAR_CALLED_FILE}" bash "${SCRIPT}"

	assert_failure
	[[ ! -e "${TAR_CALLED_FILE}" ]]
	[[ ! -e "${CARGO_HOME}/bin/wasm-pack" ]]
}
