#!/usr/bin/env bash
# Run Vitest with coverage for the documentation site.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SITE_DIR="${ROOT}/apps/site"

cd "${SITE_DIR}"

bun install --frozen-lockfile
bun run test
