#!/usr/bin/env bash
# Type-check the documentation site with Astro check.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SITE_DIR="${ROOT}/apps/site"

cd "${SITE_DIR}"

export ASTRO_TELEMETRY_DISABLED="${ASTRO_TELEMETRY_DISABLED:-1}"
export CI="${CI:-true}"

bun install --frozen-lockfile
bun run check

echo "Astro check passed for ${SITE_DIR}"
