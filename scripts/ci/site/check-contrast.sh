#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Gate the hand-authored craft theme against the WCAG AA contrast floor.
#
# Runs the checker with plain node (it has no dependencies) so the job needs
# neither a bun install nor the site build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SITE_DIR="${ROOT}/apps/site"

cd "${SITE_DIR}"

node scripts/check-craft-contrast.mjs
