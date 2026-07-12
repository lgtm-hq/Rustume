#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Create a compressed custom-format pg_dump and upload it to the R2 backups bucket.
#
# Required:
#   BACKUP_DATABASE_URL
#   R2_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#   R2_BACKUP_BUCKET
#
# Optional:
#   BACKUP_ENV          Environment label in object names (default: production)
#   BACKUP_TIMESTAMP    UTC timestamp for object naming (default: current time)
#
# Usage:
#   BACKUP_DATABASE_URL=... R2_ACCOUNT_ID=... scripts/ci/backup/backup-db.sh

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

require_env() {
	local name="$1"
	if [[ -z "${!name:-}" ]]; then
		echo "${name} is required" >&2
		exit 1
	fi
}

require_env BACKUP_DATABASE_URL
require_env R2_ACCOUNT_ID
require_env R2_ACCESS_KEY_ID
require_env R2_SECRET_ACCESS_KEY
require_env R2_BACKUP_BUCKET

ENV="${BACKUP_ENV:-production}"
TIMESTAMP="${BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
OBJECT_KEY="rustume-${ENV}-${TIMESTAMP}.dump.gz"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rustume-backup.XXXXXXXXXX")"
cleanup() {
	rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

DUMP_PATH="${WORK_DIR}/backup.dump"
GZIP_PATH="${WORK_DIR}/${OBJECT_KEY}"

echo "Creating pg_dump for ${ENV}..."
if ! pg_dump -Fc "${BACKUP_DATABASE_URL}" >"${DUMP_PATH}"; then
	echo "pg_dump failed" >&2
	exit 1
fi

if [[ ! -s "${DUMP_PATH}" ]]; then
	echo "pg_dump produced an empty file; aborting upload" >&2
	exit 1
fi

echo "Compressing dump..."
if ! gzip -c "${DUMP_PATH}" >"${GZIP_PATH}"; then
	echo "gzip failed" >&2
	exit 1
fi

if [[ ! -s "${GZIP_PATH}" ]]; then
	echo "Compressed dump is empty; aborting upload" >&2
	exit 1
fi

echo "Uploading ${OBJECT_KEY} to R2 bucket ${R2_BACKUP_BUCKET}..."
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

if ! aws s3 cp "${GZIP_PATH}" "s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}" \
	--endpoint-url "${R2_ENDPOINT}"; then
	echo "Upload to R2 failed" >&2
	exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	echo "object_key=${OBJECT_KEY}" >>"${GITHUB_OUTPUT}"
fi

echo "Backup uploaded: s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}"
