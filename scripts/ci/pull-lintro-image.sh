#!/usr/bin/env bash
# Pull the py-lintro Docker image and tag it for local use.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../utils/utils.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../utils/utils.sh"

LINTRO_IMAGE="${LINTRO_IMAGE:?LINTRO_IMAGE env var must be set}"

log_info "Pulling ${LINTRO_IMAGE}..."
docker pull "${LINTRO_IMAGE}"
docker tag "${LINTRO_IMAGE}" py-lintro:latest
log_success "Tagged ${LINTRO_IMAGE} as py-lintro:latest"
