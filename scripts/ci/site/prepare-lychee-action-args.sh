#!/usr/bin/env bash
# Prepare lychee-action CLI args from lgtm-ci build-lychee-args output.
# SPDX-License-Identifier: MIT
set -euo pipefail

: "${RAW_ARGS:?RAW_ARGS is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

ROOT_DIR="${LYCHEE_ROOT_DIR:-${GITHUB_WORKSPACE}/apps/site/dist}"

read -r -a tokens <<<"$RAW_ARGS"
filtered=()
skip_next=false
for token in "${tokens[@]}"; do
	if [[ "$skip_next" == true ]]; then
		skip_next=false
		continue
	fi
	case "$token" in
	--format | --output) skip_next=true ;;
	--format=* | --output=*) ;;
	*) filtered+=("$token") ;;
	esac
done
filtered+=(--root-dir "${ROOT_DIR}")

delimiter="lychee_action_args_$(openssl rand -hex 16)"
{
	echo "args<<${delimiter}"
	printf '%s\n' "${filtered[*]}"
	echo "${delimiter}"
} >>"$GITHUB_OUTPUT"
