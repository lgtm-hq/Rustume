#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Dry-run backup: validate pg_dump only (no upload, no prune).
#
# Required:
#   BACKUP_DATABASE_URL

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

if [[ -z "${BACKUP_DATABASE_URL:-}" ]]; then
	echo "BACKUP_DATABASE_URL is required" >&2
	exit 1
fi

echo "Dry run: validating pg_dump only (no upload)."
dump_path="$(mktemp "${TMPDIR:-/tmp}/rustume-backup-dry-run.XXXXXXXXXX")"
cleanup() {
	rm -f "${dump_path}"
}
trap cleanup EXIT

if ! pg_dump -Fc "${BACKUP_DATABASE_URL}" >"${dump_path}"; then
	echo "pg_dump failed during dry run" >&2
	exit 1
fi
if [[ ! -s "${dump_path}" ]]; then
	echo "pg_dump produced an empty file during dry run" >&2
	exit 1
fi

echo "Dry run pg_dump succeeded."
