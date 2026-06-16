#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Command mocking helpers for Rustume BATS tests.

mock_command() {
	local cmd_name="$1"
	local output="${2:-}"
	local exit_code="${3:-0}"
	local mock_bin="${BATS_TEST_TMPDIR}/bin"

	mkdir -p "${mock_bin}"

	cat >"${mock_bin}/${cmd_name}" <<EOF
#!/usr/bin/env bash
printf '%s\n' '${output//\'/\'\\\'\'}'
exit ${exit_code}
EOF
	chmod +x "${mock_bin}/${cmd_name}"

	if [[ ":${PATH}:" != *":${mock_bin}:"* ]]; then
		export PATH="${mock_bin}:${PATH}"
	fi
}

mock_command_script() {
	local cmd_name="$1"
	local script_body="$2"
	local mock_bin="${BATS_TEST_TMPDIR}/bin"

	mkdir -p "${mock_bin}"

	cat >"${mock_bin}/${cmd_name}" <<EOF
#!/usr/bin/env bash
${script_body}
EOF
	chmod +x "${mock_bin}/${cmd_name}"

	if [[ ":${PATH}:" != *":${mock_bin}:"* ]]; then
		export PATH="${mock_bin}:${PATH}"
	fi
}

save_path() {
	export _ORIGINAL_PATH="${PATH}"
}

restore_path() {
	if [[ -n "${_ORIGINAL_PATH:-}" ]]; then
		export PATH="${_ORIGINAL_PATH}"
	fi
}
