#!/usr/bin/env bash
# Build the Rustume documentation site for GitHub Pages.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SITE_DIR="${ROOT}/apps/site"

set -a
# shellcheck source=defaults.env
source "${SCRIPT_DIR}/defaults.env"
set +a

cd "${SITE_DIR}"

export ASTRO_BASE="${ASTRO_BASE:-${ASTRO_BASE_DEFAULT}}"
export ASTRO_TELEMETRY_DISABLED="${ASTRO_TELEMETRY_DISABLED:-1}"

bun install --frozen-lockfile
bun run build

echo "Site built at ${SITE_DIR}/dist (ASTRO_BASE=${ASTRO_BASE})"
