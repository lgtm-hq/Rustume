#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only

payload=""
while (($# > 0)); do
	if [[ "$1" == "-d" && $# -ge 2 ]]; then
		payload="$2"
		shift 2
	else
		shift
	fi
done

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
		echo '{"data":{"deployments":{"edges":[{"node":{"id":"new-deploy","status":"BUILDING"}}]}}}'
	fi
else
	echo '{"errors":[{"message":"unexpected query"}]}' >&2
	exit 1
fi
