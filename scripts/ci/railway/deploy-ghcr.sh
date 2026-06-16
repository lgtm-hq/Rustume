#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Point a Railway service at a GHCR image and deploy from that source.
#
# Required (either name):
#   RAILWAY_TOKEN or RAILWAY_API_TOKEN
#
# Optional (defaults for rustume-cloud production):
#   RAILWAY_PROJECT_ID      83fe27c6-ab4b-444e-97bb-f7773c92c87a
#   RAILWAY_ENVIRONMENT_ID  78af5529-02bd-42b6-8436-99f6d0e39114
#   RAILWAY_SERVICE_ID      d222fc2e-8318-453f-839f-869521b87c7a
#   RAILWAY_IMAGE           ghcr.io/lgtm-hq/rustume:main
#
# Usage:
#   RAILWAY_TOKEN=... scripts/ci/railway/deploy-ghcr.sh
#   RAILWAY_API_TOKEN=... scripts/ci/railway/deploy-ghcr.sh --graphql-only

GRAPHQL_ONLY=false

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,22p' "$0"
		exit 0
		;;
	--graphql-only)
		GRAPHQL_ONLY=true
		shift
		;;
	*)
		echo "Unknown argument: $1" >&2
		exit 2
		;;
	esac
done

RAILWAY_TOKEN="${RAILWAY_TOKEN:-${RAILWAY_API_TOKEN:-}}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN or RAILWAY_API_TOKEN is required}"

PROJECT_ID="${RAILWAY_PROJECT_ID:-83fe27c6-ab4b-444e-97bb-f7773c92c87a}"
ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:-78af5529-02bd-42b6-8436-99f6d0e39114}"
SERVICE_ID="${RAILWAY_SERVICE_ID:-d222fc2e-8318-453f-839f-869521b87c7a}"
IMAGE="${RAILWAY_IMAGE:-ghcr.io/lgtm-hq/rustume:main}"

graphql() {
	local payload="$1"
	curl -fsSL \
		-H "Authorization: Bearer ${RAILWAY_TOKEN}" \
		-H "Content-Type: application/json" \
		-d "${payload}" \
		"https://backboard.railway.com/graphql/v2"
}

deploy_via_graphql() {
	echo "Deploying ${SERVICE_ID} from ${IMAGE} via GraphQL API..."

	# CAUTION: Railway's serviceInstanceUpdate resets numReplicas to 1 if omitted.
	# Current config: 1 replica. If scaling up, include numReplicas in the input.
	# See: https://station.railway.com/questions/number-of-replicas-is-set-to-1-after-cal-433e27c8
	update_payload="$(jq -nc \
		--arg env "${ENVIRONMENT_ID}" \
		--arg svc "${SERVICE_ID}" \
		--arg img "${IMAGE}" \
		'{
      query: "mutation serviceInstanceUpdate($environmentId: String, $serviceId: String!, $input: ServiceInstanceUpdateInput!) { serviceInstanceUpdate(environmentId: $environmentId, serviceId: $serviceId, input: $input) }",
      variables: {
        environmentId: $env,
        serviceId: $svc,
        input: { source: { image: $img } }
      }
    }')"

	update_response="$(graphql "${update_payload}")"
	if echo "${update_response}" | jq -e '.errors' >/dev/null 2>&1; then
		echo "serviceInstanceUpdate failed:" >&2
		echo "${update_response}" | jq . >&2
		exit 1
	fi

	deploy_payload="$(jq -nc \
		--arg env "${ENVIRONMENT_ID}" \
		--arg svc "${SERVICE_ID}" \
		'{
      query: "mutation serviceInstanceDeployV2($environmentId: String!, $serviceId: String!) { serviceInstanceDeployV2(environmentId: $environmentId, serviceId: $serviceId) }",
      variables: { environmentId: $env, serviceId: $svc }
    }')"

	deploy_response="$(graphql "${deploy_payload}")"
	if echo "${deploy_response}" | jq -e '.errors' >/dev/null 2>&1; then
		echo "serviceInstanceDeployV2 failed:" >&2
		echo "${deploy_response}" | jq . >&2
		exit 1
	fi

	echo "Railway deploy triggered for ${IMAGE}"
	# Auto-rollback is intentionally omitted. On failure, investigate the root cause
	# and use `railway rollback` or redeploy a known-good digest manually.
	# Rationale: rollback can mask problems and is unsafe if DB migrations ran.
}

if [[ "${GRAPHQL_ONLY}" == true ]]; then
	deploy_via_graphql
	exit 0
fi

if command -v railway >/dev/null 2>&1; then
	echo "Connecting ${SERVICE_ID} to ${IMAGE} via Railway CLI..."
	railway service source connect \
		--image="${IMAGE}" \
		--service="${SERVICE_ID}" \
		--project="${PROJECT_ID}" \
		--environment="${ENVIRONMENT_ID}"

	echo "Deploying from source..."
	railway redeploy \
		--from-source \
		--service="${SERVICE_ID}" \
		--project="${PROJECT_ID}" \
		--environment="${ENVIRONMENT_ID}" \
		--yes
	exit 0
fi

deploy_via_graphql
