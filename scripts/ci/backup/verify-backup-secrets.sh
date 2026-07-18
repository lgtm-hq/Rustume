#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Verify required backup secrets are present. When any are missing, write
# skip=true to GITHUB_OUTPUT and exit 0 so the workflow can take the skip path
# until provider setup in #334 lands.
#
# Required env (values may be empty — emptiness is the failure mode):
#   BACKUP_DATABASE_URL
#   R2_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#   R2_BACKUP_BUCKET
#
# Optional:
#   GITHUB_OUTPUT  When set, writes skip=true|false

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,20p' "$0"
		exit 0
		;;
	*)
		echo "Unknown argument: $1" >&2
		exit 2
		;;
	esac
done

missing=()
for name in BACKUP_DATABASE_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID \
	R2_SECRET_ACCESS_KEY R2_BACKUP_BUCKET; do
	if [[ -z "${!name:-}" ]]; then
		missing+=("${name}")
	fi
done

if ((${#missing[@]} > 0)); then
	if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
		echo "skip=true" >>"${GITHUB_OUTPUT}"
	fi
	echo "Backup secrets not configured (${missing[*]})."
	echo "Skipping until provider setup in #334."
	exit 0
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	echo "skip=false" >>"${GITHUB_OUTPUT}"
fi
echo "All backup secrets present."
