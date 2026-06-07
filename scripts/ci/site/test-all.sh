#!/usr/bin/env bash
# Run Vitest and site script pytest for the documentation site.
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

"${ROOT}/scripts/ci/site/test.sh"
"${ROOT}/scripts/ci/site/test-python.sh"
