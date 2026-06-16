#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Log what a Railway deploy would do without creating deployments or calling Railway.

: "${RAILWAY_IMAGE:?RAILWAY_IMAGE is required}"
: "${RAILWAY_SERVICE_ID:?RAILWAY_SERVICE_ID is required}"
: "${RAILWAY_ENVIRONMENT_ID:?RAILWAY_ENVIRONMENT_ID is required}"
: "${RAILWAY_PROJECT_ID:?RAILWAY_PROJECT_ID is required}"

echo "DRY RUN — would deploy ${RAILWAY_IMAGE} to service ${RAILWAY_SERVICE_ID}"
echo "Environment: ${RAILWAY_ENVIRONMENT_ID}"
echo "Project: ${RAILWAY_PROJECT_ID}"
