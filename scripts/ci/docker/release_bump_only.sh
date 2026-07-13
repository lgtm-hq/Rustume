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

# Cargo.toml diff (added/removed lines only) must contain nothing but
# version stamps.
toml_diff=$(git diff --unified=0 "${base}" "${head}" -- Cargo.toml |
	grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' || true)
if [[ -n "${toml_diff}" ]]; then
	bad=$(echo "${toml_diff}" |
		grep -vE '^[+-]version = "[0-9]+\.[0-9]+\.[0-9]+[^"]*"$' || true)
	if [[ -n "${bad}" ]]; then
		echo "not bump-only: non-version change in Cargo.toml:" >&2
		echo "${bad}" >&2
		echo "false"
		exit 0
	fi
fi

# Cargo.lock: a line-level version check is spoofable — a dependency bump
# whose diff happens to touch only `version = "..."` lines would pass. So
# parse both revisions into (name, version, has-checksum) entries and require
# every changed package to be checksum-less in both revisions: workspace
# members carry no checksum, external/registry packages always do. Package
# additions or removals never qualify as a bump.
parse_lock() {
	git show "$1:Cargo.lock" 2>/dev/null | awk '
		/^name = /     { gsub(/"/, ""); name = $3 }
		/^version = /  { gsub(/"/, ""); ver = $3 }
		/^checksum = / { ck = 1 }
		/^$/ {
			if (name != "") { print name "\t" ver "\t" (ck + 0) }
			name = ""; ver = ""; ck = 0
		}
		END { if (name != "") { print name "\t" ver "\t" ck } }
	'
}

if ! git diff --quiet "${base}" "${head}" -- Cargo.lock; then
	base_lock="$(parse_lock "${base}")"
	head_lock="$(parse_lock "${head}")"
	# comm prefixes column-2 (head-only) lines with a tab — strip it before
	# taking the package-name field, or added packages would be missed.
	changed_pkgs=$(comm -3 <(sort <<<"${base_lock}") <(sort <<<"${head_lock}") |
		sed 's/^\t//' | cut -f1 | sort -u)
	while IFS= read -r pkg; do
		[[ -z "${pkg}" ]] && continue
		base_entry=$(grep -m1 "^${pkg}	" <<<"${base_lock}" || true)
		head_entry=$(grep -m1 "^${pkg}	" <<<"${head_lock}" || true)
		if [[ -z "${base_entry}" || -z "${head_entry}" ]]; then
			echo "not bump-only: package added/removed in Cargo.lock: ${pkg}" >&2
			echo "false"
			exit 0
		fi
		if [[ "${base_entry##*	}" != "0" || "${head_entry##*	}" != "0" ]]; then
			echo "not bump-only: external package changed in Cargo.lock: ${pkg}" >&2
			echo "false"
			exit 0
		fi
	done <<<"${changed_pkgs}"
fi

echo "true"
