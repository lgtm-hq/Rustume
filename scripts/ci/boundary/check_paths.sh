#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Ops-boundary path guard for the public Rustume repo.
#
# Fails when tracked files match ops-shaped path patterns that belong in the
# private rustume-ops repo (see LICENSING.md for the boundary policy):
#   - Terraform: *.tf, *.tfvars, .terraform.lock.hcl
#   - Infra trees: infra/ at any depth
#   - Runbook/playbook documents
#
# Deliberate exceptions live in .boundary-allowlist at the repo root — one
# repo-relative path per line, each with a trailing "# justification" comment.
#
# Usage:
#   scripts/ci/boundary/check_paths.sh

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,18p' "$0"
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

allow_file=".boundary-allowlist"
allowed=""
if [[ -f "${allow_file}" ]]; then
	# Strip "# justification" comments and blank lines; keep one path per line.
	allowed="$(sed -e 's/[[:space:]]*#.*$//' -e '/^[[:space:]]*$/d' "${allow_file}")"
fi

is_allowed() {
	local candidate="$1"
	[[ -n "${allowed}" ]] && grep -Fxq "${candidate}" <<<"${allowed}"
}

violations=""
while IFS=$'\t' read -r lower file; do
	case "${lower}" in
	*.tf | *.tfvars | .terraform.lock.hcl | */.terraform.lock.hcl | infra/* | */infra/* | *runbook* | *playbook*)
		if ! is_allowed "${file}"; then
			violations="${violations}${file}"$'\n'
		fi
		;;
	esac
done < <(git ls-files | awk '{ print tolower($0) "\t" $0 }')

if [[ -n "${violations}" ]]; then
	echo "Ops-boundary violation: these tracked files are ops-shaped and belong in rustume-ops:" >&2
	printf '%s' "${violations}" | sed 's/^/  - /' >&2
	echo "See LICENSING.md for the boundary policy." >&2
	echo "Deliberate exceptions go in ${allow_file} with a justification comment." >&2
	exit 1
fi

echo "Boundary path guard passed: no ops-shaped paths tracked."
