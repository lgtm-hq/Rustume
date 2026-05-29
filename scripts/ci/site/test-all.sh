#!/usr/bin/env bash
# Run Astro check, Vitest, and site script pytest for the documentation site.
# SPDX-License-Identifier: MIT
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

"${ROOT}/scripts/ci/site/test.sh"
"${ROOT}/scripts/ci/site/test-python.sh"
