#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Poll Railway for the latest deployment status after triggering a deploy.
# Exits 0 on SUCCESS, non-zero on FAILED/CRASHED/timeout.
#
# Auto-rollback is intentionally omitted. On failure, investigate the cause
# and use `railway rollback` or redeploy a known-good image manually.
# Rationale: rollback can mask the problem and is unsafe if migrations ran.

RAILWAY_TOKEN="${RAILWAY_TOKEN:-${RAILWAY_API_TOKEN:-}}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN or RAILWAY_API_TOKEN is required}"

SERVICE_ID="${RAILWAY_SERVICE_ID:?RAILWAY_SERVICE_ID is required}"
ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:?RAILWAY_ENVIRONMENT_ID is required}"

TIMEOUT_SECONDS="${DEPLOY_POLL_TIMEOUT:-300}"
POLL_INTERVAL="${DEPLOY_POLL_INTERVAL:-10}"

graphql() {
	curl -fsSL \
		-H "Authorization: Bearer ${RAILWAY_TOKEN}" \
		-H "Content-Type: application/json" \
		-d "$1" \
		"https://backboard.railway.com/graphql/v2"
}

query_payload="$(jq -nc \
	--arg env "${ENVIRONMENT_ID}" \
	--arg svc "${SERVICE_ID}" \
	'{
    query: "query latestDeploy($serviceId: String!, $environmentId: String!) { deployments(first: 1, input: { serviceId: $serviceId, environmentId: $environmentId }) { edges { node { id status } } } }",
    variables: { serviceId: $svc, environmentId: $env }
  }')"

elapsed=0
while ((elapsed < TIMEOUT_SECONDS)); do
	response="$(graphql "${query_payload}")"
	status="$(echo "${response}" | jq -r '.data.deployments.edges[0].node.status // "UNKNOWN"')"

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
