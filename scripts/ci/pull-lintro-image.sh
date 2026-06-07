#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Pull the py-lintro Docker image and tag it for local use.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../utils/utils.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../utils/utils.sh"

LINTRO_IMAGE="${LINTRO_IMAGE:?LINTRO_IMAGE env var must be set}"

log_info "Pulling ${LINTRO_IMAGE}..."
docker pull "${LINTRO_IMAGE}"
log_success "Pulled ${LINTRO_IMAGE}"
