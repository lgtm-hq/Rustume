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
	# Call order in deploy_via_graphql(): 1=pre-deploy fetch, 2=update, 3=deploy,
	# 4+=poll. count<=1 returns old-deploy; count>=2 returns new-deploy.
	if [[ "${count}" -le 1 ]]; then
		echo '{"data":{"deployments":{"edges":[{"node":{"id":"old-deploy","status":"SUCCESS"}}]}}}'
	else
		echo '{"data":{"deployments":{"edges":[{"node":{"id":"new-deploy","status":"BUILDING"}}]}}}'
	fi
else
	echo '{"errors":[{"message":"unexpected query"}]}' >&2
	exit 1
fi
