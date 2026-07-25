#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# check-tooling-ref-sync.sh
#
# Guard against lgtm-ci pin drift in .github/workflows/*.yml.
#
# Each caller workflow pins lgtm-ci twice: once in the `uses:` reference that
# Renovate's github-actions manager owns, and once in a `tooling-ref:` string
# input that only the repo-local Renovate custom manager owns. Two managers on
# one logical pin means the halves can drift, so this guard enforces:
#
#   1. Per file — every `tooling-ref:` SHA (and its `# vX.Y.Z` comment) matches
#      an lgtm-ci `uses:` pin in the same file.
#   2. Repo-wide — every lgtm-ci pin in .github/workflows/*.yml resolves to a
#      single SHA and a single version comment.
#   3. Parsability — every `tooling-ref:` line is recognized (quoted or not);
#      an unparsable one is reported instead of silently skipped.
#
# Usage:
#   scripts/ci/maintenance/check-tooling-ref-sync.sh [workflow-dir]

workflow_dir=".github/workflows"

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,24p' "$0"
		exit 0
		;;
	-*)
		echo "Unknown argument: $1" >&2
		exit 2
		;;
	*)
		workflow_dir="$1"
		shift
		;;
	esac
done

if [[ -z ${workflow_dir} || ! -d ${workflow_dir} ]]; then
	echo "Workflow directory not found: ${workflow_dir}" >&2
	exit 2
fi

# YAML scalars accept unquoted, single-quoted and double-quoted forms, so match
# all three: a formatting-only edit must not drop a pin out of the guard's view.
q="[\"']"
uses_re="^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]*${q}?lgtm-hq/lgtm-ci/[^@\"'[:space:]]+@([0-9a-f]{40})${q}?[[:space:]]*#[[:space:]]*(v[0-9]+\.[0-9]+\.[0-9]+)"
ref_re="^[[:space:]]*tooling-ref:[[:space:]]*(${q}?)([0-9a-f]{40})(${q}?)[[:space:]]*#[[:space:]]*(v[0-9]+\.[0-9]+\.[0-9]+)"
# Any tooling-ref line that ref_re cannot parse is reported rather than skipped.
ref_line_re='^[[:space:]]*tooling-ref:'

violations=""
all_pins=""
checked=0

add_violation() {
	violations="${violations}$1"$'\n'
}

while IFS= read -r file; do
	uses_pins=""
	ref_pins=""

	while IFS= read -r line; do
		if [[ ${line} =~ ${uses_re} ]]; then
			uses_pins="${uses_pins}${BASH_REMATCH[2]} ${BASH_REMATCH[3]}"$'\n'
		elif [[ ${line} =~ ${ref_line_re} ]]; then
			if [[ ${line} =~ ${ref_re} && ${BASH_REMATCH[1]} == "${BASH_REMATCH[3]}" ]]; then
				ref_pins="${ref_pins}${BASH_REMATCH[2]} ${BASH_REMATCH[4]}"$'\n'
			else
				add_violation "${file}: unparsable tooling-ref line: ${line#"${line%%[![:space:]]*}"}"
			fi
		fi
	done <"${file}"

	all_pins="${all_pins}${uses_pins}${ref_pins}"

	[[ -z ${ref_pins} ]] && continue

	while IFS= read -r ref_pin; do
		[[ -z ${ref_pin} ]] && continue
		checked=$((checked + 1))
		if [[ -z ${uses_pins} ]]; then
			add_violation "${file}: tooling-ref '${ref_pin}' has no lgtm-ci 'uses:' pin in the same file"
		elif ! grep -Fxq "${ref_pin}" <<<"${uses_pins}"; then
			add_violation "${file}: tooling-ref '${ref_pin}' does not match any 'uses:' pin in the same file"
			while IFS= read -r uses_pin; do
				[[ -n ${uses_pin} ]] && add_violation "  uses: ${uses_pin}"
			done <<<"${uses_pins}"
		fi
	done <<<"${ref_pins}"
done < <(find "${workflow_dir}" -maxdepth 1 -name '*.yml' | sort)

distinct_pins="$(grep -v '^$' <<<"${all_pins}" | sort -u || true)"
distinct_count="$(grep -c . <<<"${distinct_pins}" || true)"

if [[ -n ${distinct_pins} && ${distinct_count} -gt 1 ]]; then
	add_violation "lgtm-ci is pinned to more than one version across ${workflow_dir}:"
	while IFS= read -r pin; do
		[[ -n ${pin} ]] && add_violation "  ${pin}"
	done <<<"${distinct_pins}"
fi

if [[ -n ${violations} ]]; then
	echo "lgtm-ci pin drift detected:" >&2
	printf '%s' "${violations}" | sed 's/^/  /' >&2
	echo "Every 'tooling-ref:' must repeat the 'uses:' SHA in its own file," >&2
	echo "and all workflows must sit on the same lgtm-ci release." >&2
	exit 1
fi

echo "lgtm-ci pin sync guard passed: ${checked} tooling-ref pin(s) match their 'uses:' pins."
