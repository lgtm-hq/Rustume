#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Create a GitHub Deployment entry for a Railway deploy.
#
# Required:
#   DEPLOY_REF       Git ref to deploy (commit SHA)
#   GITHUB_OUTPUT    GitHub Actions output file path
#
# Optional:
#   GITHUB_REPOSITORY  required in GitHub Actions

: "${DEPLOY_REF:?DEPLOY_REF is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

deploy_id="$(jq -nc \
	--arg ref "${DEPLOY_REF}" \
	'{
    ref: $ref,
    environment: "production",
    description: "Railway deploy from ghcr.io/lgtm-hq/rustume:main",
    auto_merge: false,
    required_contexts: []
  }' |
	gh api "repos/${GITHUB_REPOSITORY}/deployments" --input - --jq '.id')"

echo "id=${deploy_id}" >>"${GITHUB_OUTPUT}"
