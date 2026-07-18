#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Ops-boundary content guard for the public Rustume repo.
#
# Runs the repo-local Semgrep rules in .semgrep/ (concrete production
# topology patterns — Neon endpoints, Railway hostnames, R2 account
# endpoints) and fails on any finding. See LICENSING.md for the policy.
#
# Semgrep is provided by the uv "lint" dependency group (via lintro),
# so versions are locked through uv.lock.
#
# Usage:
#   scripts/ci/boundary/check_content.sh

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,15p' "$0"
		exit 0
		;;
	*)
		echo "Unknown argument: $1" >&2
		exit 2
		;;
	esac
done

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

uv run --group lint semgrep scan \
	--config .semgrep \
	--error \
	--metrics=off \
	--quiet \
	.

echo "Boundary content guard passed: no production topology patterns found."
