#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Update a GitHub Deployment status entry.
#
# Required:
#   DEPLOY_ID        GitHub Deployment ID
#   DEPLOY_STATE     success | failure
#
# Optional:
#   DEPLOY_DESCRIPTION
#   DEPLOY_ENVIRONMENT_URL  set for successful production deploys
#   GITHUB_REPOSITORY

: "${DEPLOY_ID:?DEPLOY_ID is required}"
: "${DEPLOY_STATE:?DEPLOY_STATE is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
description="${DEPLOY_DESCRIPTION:-Railway deployment status updated}"

args=(
	-f "state=${DEPLOY_STATE}"
	-f "environment=production"
	-f "description=${description}"
)

if [[ -n "${DEPLOY_ENVIRONMENT_URL:-}" ]]; then
	args+=(-f "environment_url=${DEPLOY_ENVIRONMENT_URL}")
fi

gh api "repos/${GITHUB_REPOSITORY}/deployments/${DEPLOY_ID}/statuses" "${args[@]}"
