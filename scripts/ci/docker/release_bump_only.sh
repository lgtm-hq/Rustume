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

# Cargo.toml: a bare version-line diff check is section-blind — a
# `version = "..."` line under [dependencies.foo] looks identical to the
# crate's own version stamp. Instead, strip the version line from the
# [package] / [workspace.package] sections of both revisions and require the
# remainders to be byte-identical: then the ONLY change is the crate version.
strip_pkg_version() {
	git show "$1:Cargo.toml" 2>/dev/null | awk '
		/^\[/ { in_pkg = ($0 == "[package]" || $0 == "[workspace.package]") }
		!(in_pkg && /^version = "[0-9]+\.[0-9]+\.[0-9]+[^"]*"$/)
	'
}

if ! git diff --quiet "${base}" "${head}" -- Cargo.toml; then
	if ! diff -q <(strip_pkg_version "${base}") <(strip_pkg_version "${head}") >/dev/null; then
		echo "not bump-only: Cargo.toml changed outside [package]/[workspace.package] version" >&2
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
	base_lock="$(parse_lock "${base}" | sort)"
	head_lock="$(parse_lock "${head}" | sort)"
	# Compare full (name, version, has-checksum) rows — a name-keyed lookup
	# would mis-select when the same crate exists at multiple versions.
	removed_rows=$(comm -23 <(printf '%s\n' "${base_lock}") <(printf '%s\n' "${head_lock}"))
	added_rows=$(comm -13 <(printf '%s\n' "${base_lock}") <(printf '%s\n' "${head_lock}"))
	bad_rows=$(printf '%s\n%s\n' "${removed_rows}" "${added_rows}" |
		awk -F'\t' 'NF && $3 != 0 { print $1 " " $2 }')
	if [[ -n "${bad_rows}" ]]; then
		echo "not bump-only: external package changed in Cargo.lock:" >&2
		echo "${bad_rows}" >&2
		echo "false"
		exit 0
	fi
	# The multiset of changed package names must match on both sides — a bump
	# never adds or removes packages.
	if ! diff -q <(awk -F'\t' 'NF{print $1}' <<<"${removed_rows}" | sort) \
		<(awk -F'\t' 'NF{print $1}' <<<"${added_rows}" | sort) >/dev/null; then
		echo "not bump-only: package set changed in Cargo.lock" >&2
		echo "false"
		exit 0
	fi
fi

echo "true"
