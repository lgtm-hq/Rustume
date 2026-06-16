#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Poll Railway for deployment status after triggering a deploy.
# Exits 0 on SUCCESS, non-zero on FAILED/CRASHED/timeout.
#
# Prefer RAILWAY_DEPLOYMENT_ID from deploy-ghcr.sh to avoid matching a stale SUCCESS.
#
# Auto-rollback is intentionally omitted. On failure, investigate the cause
# and use `railway rollback` or redeploy a known-good image manually.
# Rationale: rollback can mask the problem and is unsafe if migrations ran.

RAILWAY_TOKEN="${RAILWAY_TOKEN:-${RAILWAY_API_TOKEN:-}}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN or RAILWAY_API_TOKEN is required}"

SERVICE_ID="${RAILWAY_SERVICE_ID:-}"
ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:-}"
DEPLOYMENT_ID="${RAILWAY_DEPLOYMENT_ID:-}"

if [[ -z "${DEPLOYMENT_ID}" ]]; then
	: "${SERVICE_ID:?RAILWAY_SERVICE_ID is required when RAILWAY_DEPLOYMENT_ID is unset}"
	: "${ENVIRONMENT_ID:?RAILWAY_ENVIRONMENT_ID is required when RAILWAY_DEPLOYMENT_ID is unset}"
fi

TIMEOUT_SECONDS="${DEPLOY_POLL_TIMEOUT:-300}"
POLL_INTERVAL="${DEPLOY_POLL_INTERVAL:-10}"

validate_positive_int() {
	local name="$1"
	local value="$2"
	if ! [[ "${value}" =~ ^[1-9][0-9]*$ ]]; then
		echo "${name} must be a positive integer, got: ${value}" >&2
		exit 1
	fi
}

validate_positive_int "DEPLOY_POLL_TIMEOUT" "${TIMEOUT_SECONDS}"
validate_positive_int "DEPLOY_POLL_INTERVAL" "${POLL_INTERVAL}"

CURL_CONNECT_TIMEOUT="${RAILWAY_CURL_CONNECT_TIMEOUT:-10}"
CURL_MAX_TIME="${RAILWAY_CURL_MAX_TIME:-30}"

graphql() {
	curl -fsSL \
		--connect-timeout "${CURL_CONNECT_TIMEOUT}" \
		--max-time "${CURL_MAX_TIME}" \
		--retry 2 \
		-H "Authorization: Bearer ${RAILWAY_TOKEN}" \
		-H "Content-Type: application/json" \
		-d "$1" \
		"https://backboard.railway.com/graphql/v2"
}

parse_graphql_response() {
	local response="$1"
	if echo "${response}" | jq -e '.errors' >/dev/null 2>&1; then
		echo "GraphQL query failed:" >&2
		echo "${response}" | jq . >&2
		exit 1
	fi
}

if [[ -n "${DEPLOYMENT_ID}" ]]; then
	query_payload="$(jq -nc \
		--arg id "${DEPLOYMENT_ID}" \
		'{
      query: "query deploymentStatus($id: String!) { deployment(id: $id) { status } }",
      variables: { id: $id }
    }')"
else
	echo "RAILWAY_DEPLOYMENT_ID not set; polling latest deployment for service." >&2
	sleep "${DEPLOY_REGISTER_DELAY:-5}"
	query_payload="$(jq -nc \
		--arg env "${ENVIRONMENT_ID}" \
		--arg svc "${SERVICE_ID}" \
		'{
      query: "query latestDeploy($serviceId: String!, $environmentId: String!) { deployments(first: 1, input: { serviceId: $serviceId, environmentId: $environmentId }) { edges { node { id status } } } }",
      variables: { serviceId: $svc, environmentId: $env }
    }')"
fi

status="UNKNOWN"
elapsed=0
while ((elapsed < TIMEOUT_SECONDS)); do
	response="$(graphql "${query_payload}")"
	parse_graphql_response "${response}"

	if [[ -n "${DEPLOYMENT_ID}" ]]; then
		status="$(echo "${response}" | jq -r '.data.deployment.status // "UNKNOWN"')"
	else
		status="$(echo "${response}" | jq -r '.data.deployments.edges[0].node.status // "UNKNOWN"')"
	fi

	echo "[${elapsed}s] Deployment status: ${status}"

	case "${status}" in
	SUCCESS)
		echo "Deployment succeeded."
		exit 0
		;;
	FAILED | CRASHED)
		echo "Deployment ${status}. Investigate and rollback manually." >&2
		exit 1
		;;
	REMOVED | SKIPPED)
		echo "Deployment ${status} — unexpected state." >&2
		exit 1
		;;
	esac

	sleep "${POLL_INTERVAL}"
	elapsed=$((elapsed + POLL_INTERVAL))
done

echo "Timeout after ${TIMEOUT_SECONDS}s. Last status: ${status}" >&2
echo "Deployment may still be in progress. Check Railway dashboard." >&2
exit 1
