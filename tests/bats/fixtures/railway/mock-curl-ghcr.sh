#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Parameterized mock curl for deploy-ghcr.bats error-path tests.
#
# Required:
#   MOCK_CURL_MODE=update_error|deploy_error|predeploy_error|poll_error
#
# For poll_error, also set COUNTER_FILE to a writable path (call counter).

set -euo pipefail

payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done

mode="${MOCK_CURL_MODE:-}"
case "${mode}" in
update_error)
	if [[ "${payload}" == *"deployments"* ]]; then
		echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
	elif [[ "${payload}" == *"serviceInstanceUpdate"* ]]; then
		echo '{"errors":[{"message":"update failed"}]}'
	else
		echo '{"data":{}}'
	fi
	;;
deploy_error)
	if [[ "${payload}" == *"deployments"* ]]; then
		echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
	elif [[ "${payload}" == *"serviceInstanceUpdate"* ]]; then
		echo '{"data":{"serviceInstanceUpdate":true}}'
	elif [[ "${payload}" == *"serviceInstanceDeployV2"* ]]; then
		echo '{"errors":[{"message":"deploy failed"}]}'
	else
		echo '{"data":{}}'
	fi
	;;
predeploy_error)
	if [[ "${payload}" == *"deployments"* ]]; then
		echo '{"errors":[{"message":"deployments query failed"}]}'
	else
		echo '{"data":{}}'
	fi
	;;
poll_error)
	if [[ -z "${COUNTER_FILE:-}" ]]; then
		echo "COUNTER_FILE must be set" >&2
		exit 1
	fi
	count="$(cat "${COUNTER_FILE}")"
	count=$((count + 1))
	echo "${count}" >"${COUNTER_FILE}"
	if [[ "${payload}" == *"serviceInstanceUpdate"* ]]; then
		echo '{"data":{"serviceInstanceUpdate":true}}'
	elif [[ "${payload}" == *"serviceInstanceDeployV2"* ]]; then
		echo '{"data":{"serviceInstanceDeployV2":true}}'
	elif [[ "${payload}" == *"deployments"* ]]; then
		if [[ "${count}" -le 1 ]]; then
			echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
		else
			echo '{"errors":[{"message":"polling query failed"}]}'
		fi
	else
		echo '{"data":{}}'
	fi
	;;
*)
	echo "MOCK_CURL_MODE must be one of: update_error, deploy_error, predeploy_error, poll_error" >&2
	exit 1
	;;
esac
