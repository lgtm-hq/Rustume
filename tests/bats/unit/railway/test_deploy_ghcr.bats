#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/railway/deploy-ghcr.sh

load "../../helpers/common"
load "../../helpers/mocks"

setup() {
	setup_temp_dir
	save_path
	clear_railway_tokens
	export GITHUB_OUTPUT="${BATS_TEST_TMPDIR}/github_output"
	touch "${GITHUB_OUTPUT}"
}

teardown() {
	restore_path
	teardown_temp_dir
}

@test "deploy-ghcr: --help exits successfully" {
	run bash "${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh" --help

	assert_success
	assert_output --partial "RAILWAY_TOKEN or RAILWAY_API_TOKEN"
}

@test "deploy-ghcr: fails when token is missing" {
	run bash "${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh" --graphql-only

	assert_failure
	assert_output --partial "RAILWAY_TOKEN or RAILWAY_API_TOKEN is required"
}

@test "deploy-ghcr: rejects invalid DEPLOY_ID_REGISTER_INTERVAL" {
	run env \
		RAILWAY_TOKEN="test-token" \
		DEPLOY_ID_REGISTER_INTERVAL="0" \
		bash "${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh" --graphql-only

	assert_failure
	assert_output --partial "DEPLOY_ID_REGISTER_INTERVAL must be a positive integer"
}

@test "deploy-ghcr: graphql-only triggers deploy and writes deployment_id" {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	local counter_file="${BATS_TEST_TMPDIR}/curl_calls"
	mkdir -p "${mock_bin}"
	echo "0" >"${counter_file}"
	cp "${PROJECT_ROOT}/tests/bats/fixtures/railway/mock-curl-deploy.sh" "${mock_bin}/curl"
	chmod +x "${mock_bin}/curl"

	run bash -c "
		PATH='${mock_bin}:'\"\${PATH}\" \
		COUNTER_FILE='${counter_file}' \
		RAILWAY_TOKEN='test-token' \
		DEPLOY_ID_REGISTER_TIMEOUT='5' \
		DEPLOY_ID_REGISTER_INTERVAL='1' \
		GITHUB_OUTPUT='${GITHUB_OUTPUT}' \
		bash '${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh' --graphql-only
	"

	assert_success
	assert_output --partial "Railway deploy triggered"
	assert_equal "new-deploy" "$(get_github_output deployment_id)"
}

@test "deploy-ghcr: graphql-only fails when serviceInstanceUpdate returns errors" {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	mkdir -p "${mock_bin}"

	cat >"${mock_bin}/curl" <<'EOF'
#!/usr/bin/env bash
payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done
if [[ "${payload}" == *"deployments"* ]]; then
	echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
elif [[ "${payload}" == *"serviceInstanceUpdate"* ]]; then
	echo '{"errors":[{"message":"update failed"}]}'
else
	echo '{"data":{}}'
fi
EOF
	chmod +x "${mock_bin}/curl"

	run bash -c "
		PATH='${mock_bin}:'\"\${PATH}\" \
		RAILWAY_TOKEN='test-token' \
		bash '${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh' --graphql-only
	"

	assert_failure
	assert_output --partial "serviceInstanceUpdate failed"
}

@test "deploy-ghcr: graphql-only fails when serviceInstanceDeployV2 returns errors" {
	local mock_bin="${BATS_TEST_TMPDIR}/bin"
	mkdir -p "${mock_bin}"

	cat >"${mock_bin}/curl" <<'EOF'
#!/usr/bin/env bash
payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done
if [[ "${payload}" == *"deployments"* ]]; then
	echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
elif [[ "${payload}" == *"serviceInstanceUpdate"* ]]; then
	echo '{"data":{"serviceInstanceUpdate":true}}'
elif [[ "${payload}" == *"serviceInstanceDeployV2"* ]]; then
	echo '{"errors":[{"message":"deploy failed"}]}'
else
	echo '{"data":{}}'
fi
EOF
	chmod +x "${mock_bin}/curl"

	run bash -c "
		PATH='${mock_bin}:'\"\${PATH}\" \
		RAILWAY_TOKEN='test-token' \
		bash '${RAILWAY_SCRIPTS_DIR}/deploy-ghcr.sh' --graphql-only
	"

	assert_failure
	assert_output --partial "serviceInstanceDeployV2 failed"
}
