#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
#
# Decide whether a commit range is a release-version-bump-only change, so the
# Docker publish (and the Railway deploy chained on it) can be skipped for
# commits that only stamp a new version (#457).
#
# A range qualifies as bump-only when ALL of the following hold:
#   1. Changed files are a subset of: CHANGELOG.md, Cargo.toml, Cargo.lock.
#   2. The Cargo.toml diff touches only `version = "..."` lines.
#   3. The Cargo.lock diff touches only `version = "..."` lines.
# CHANGELOG.md content is not inspected (never affects the image).
#
# The file allowlist alone is NOT sufficient: dependency updates (Renovate)
# also touch only Cargo.toml + Cargo.lock and must still build. The
# version-line-only diff check is what separates the two.
#
# Usage: release_bump_only.sh <base-sha> <head-sha>
# Output: prints "true" or "false" to stdout; always exits 0 unless misused.

set -euo pipefail

if [[ $# -ne 2 ]]; then
	echo "usage: $0 <base-sha> <head-sha>" >&2
	exit 2
fi

base="$1"
head="$2"

# Force-push / branch-creation pushes have an all-zero before SHA — no
# meaningful diff, never classify as bump-only.
if [[ "${base}" =~ ^0+$ ]]; then
	echo "false"
	exit 0
fi

allowed_files=("CHANGELOG.md" "Cargo.toml" "Cargo.lock")

changed_files=$(git diff --name-only "${base}" "${head}")

if [[ -z "${changed_files}" ]]; then
	echo "false"
	exit 0
fi

while IFS= read -r f; do
	ok=false
	for a in "${allowed_files[@]}"; do
		if [[ "${f}" == "${a}" ]]; then
			ok=true
			break
		fi
	done
	if [[ "${ok}" == "false" ]]; then
		echo "not bump-only: ${f} outside allowlist" >&2
		echo "false"
		exit 0
	fi
done <<<"${changed_files}"

# Diff content lines (added/removed only, no context/headers) must all be
# version stamps in the two manifest files.
for manifest in "Cargo.toml" "Cargo.lock"; do
	diff_lines=$(git diff --unified=0 "${base}" "${head}" -- "${manifest}" |
		grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' || true)
	if [[ -z "${diff_lines}" ]]; then
		continue
	fi
	bad=$(echo "${diff_lines}" |
		grep -vE '^[+-]version = "[0-9]+\.[0-9]+\.[0-9]+[^"]*"$' || true)
	if [[ -n "${bad}" ]]; then
		echo "not bump-only: non-version change in ${manifest}:" >&2
		echo "${bad}" >&2
		echo "false"
		exit 0
	fi
done

echo "true"
