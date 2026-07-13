#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Enforce grandfather-father-son retention for R2 database backups.
#
# Required:
#   R2_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#   R2_BACKUP_BUCKET
#
# Optional:
#   BACKUP_ENV                 Environment label filter (default: production)
#   BACKUP_DAILY_RETENTION     Daily backups to keep (default: 7)
#   BACKUP_WEEKLY_RETENTION    Weekly backups to keep (default: 4)
#   BACKUP_MONTHLY_RETENTION   Monthly backups to keep (default: 6)
#   BACKUP_REFERENCE_EPOCH     Reference "now" for age math (default: current time)
#
# Usage:
#   scripts/ci/backup/prune-backups.sh [--dry-run]

DRY_RUN=false

while (($# > 0)); do
	case "$1" in
	--help | -h)
		cat <<'EOF'
Enforce grandfather-father-son retention for R2 database backups.

Usage:
  scripts/ci/backup/prune-backups.sh [--dry-run]

Environment:
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BACKUP_BUCKET
  BACKUP_ENV (default: production)
  BACKUP_DAILY_RETENTION (default: 7)
  BACKUP_WEEKLY_RETENTION (default: 4)
  BACKUP_MONTHLY_RETENTION (default: 6)
  BACKUP_REFERENCE_EPOCH (default: current epoch seconds)
EOF
		exit 0
		;;
	--dry-run)
		DRY_RUN=true
		shift
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

require_env R2_ACCOUNT_ID
require_env R2_ACCESS_KEY_ID
require_env R2_SECRET_ACCESS_KEY
require_env R2_BACKUP_BUCKET

ENV="${BACKUP_ENV:-production}"
DAILY_RETENTION="${BACKUP_DAILY_RETENTION:-7}"
WEEKLY_RETENTION="${BACKUP_WEEKLY_RETENTION:-4}"
MONTHLY_RETENTION="${BACKUP_MONTHLY_RETENTION:-6}"
REFERENCE_EPOCH="${BACKUP_REFERENCE_EPOCH:-$(date -u +%s)}"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
OBJECT_PREFIX="rustume-${ENV}-"

validate_positive_int() {
	local name="$1"
	local value="$2"
	if ! [[ "${value}" =~ ^[1-9][0-9]*$ ]]; then
		echo "${name} must be a positive integer, got: ${value}" >&2
		exit 1
	fi
}

validate_positive_int "BACKUP_DAILY_RETENTION" "${DAILY_RETENTION}"
validate_positive_int "BACKUP_WEEKLY_RETENTION" "${WEEKLY_RETENTION}"
validate_positive_int "BACKUP_MONTHLY_RETENTION" "${MONTHLY_RETENTION}"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

parse_object_epoch() {
	local key="$1"
	local prefix="${OBJECT_PREFIX}"
	local timestamp="${key#"${prefix}"}"
	timestamp="${timestamp%.dump.gz}"
	if [[ ! "${timestamp}" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]; then
		return 1
	fi
	local year month day hour minute second
	year="${timestamp:0:4}"
	month="${timestamp:4:2}"
	day="${timestamp:6:2}"
	hour="${timestamp:9:2}"
	minute="${timestamp:11:2}"
	second="${timestamp:13:2}"
	date -u -d "${year}-${month}-${day} ${hour}:${minute}:${second}" +%s 2>/dev/null ||
		date -u -j -f "%Y-%m-%d %H:%M:%S" "${year}-${month}-${day} ${hour}:${minute}:${second}" +%s
}

age_days() {
	local object_epoch="$1"
	echo $(((REFERENCE_EPOCH - object_epoch) / 86400))
}

should_keep_backup() {
	local object_epoch="$1"
	local age
	age="$(age_days "${object_epoch}")"

	if ((age < DAILY_RETENTION)); then
		return 0
	fi

	local weekly_start=$((DAILY_RETENTION))
	local weekly_end=$((DAILY_RETENTION + WEEKLY_RETENTION * 7))
	if ((age >= weekly_start && age < weekly_end)); then
		local week_id
		week_id="$(date -u -d "@${object_epoch}" +%G-W%V 2>/dev/null ||
			date -u -r "${object_epoch}" +%G-W%V 2>/dev/null || echo "")"
		if [[ -z "${week_id}" ]]; then
			return 1
		fi
		if [[ -n "${seen_weeks[${week_id}]:-}" ]]; then
			return 1
		fi
		seen_weeks["${week_id}"]=1
		return 0
	fi

	local monthly_start="${weekly_end}"
	local monthly_end=$((weekly_end + MONTHLY_RETENTION * 30))
	if ((age >= monthly_start && age < monthly_end)); then
		local month_id
		month_id="$(date -u -d "@${object_epoch}" +%Y-%m 2>/dev/null ||
			date -u -r "${object_epoch}" +%Y-%m 2>/dev/null || echo "")"
		if [[ -z "${month_id}" ]]; then
			return 1
		fi
		if [[ -n "${seen_months[${month_id}]:-}" ]]; then
			return 1
		fi
		seen_months["${month_id}"]=1
		return 0
	fi

	return 1
}

declare -A seen_weeks=()
declare -A seen_months=()

if ! list_output="$(aws s3 ls "s3://${R2_BACKUP_BUCKET}/" --endpoint-url "${R2_ENDPOINT}")"; then
	echo "Failed to list backups in s3://${R2_BACKUP_BUCKET}/" >&2
	exit 1
fi
if [[ -z "${list_output}" ]]; then
	echo "No backups found in s3://${R2_BACKUP_BUCKET}/"
	exit 0
fi

mapfile -t object_keys < <(
	awk '{print $4}' <<<"${list_output}" |
		grep -E "^${OBJECT_PREFIX}[0-9]{8}T[0-9]{6}Z\\.dump\\.gz$" |
		sort -r
)

if ((${#object_keys[@]} == 0)); then
	echo "No matching backups found for prefix ${OBJECT_PREFIX}"
	exit 0
fi

kept=0
deleted=0

for key in "${object_keys[@]}"; do
	object_epoch="$(parse_object_epoch "${key}")" || continue

	if should_keep_backup "${object_epoch}"; then
		echo "Keeping ${key} (age $(age_days "${object_epoch}")d)"
		kept=$((kept + 1))
		continue
	fi

	if [[ "${DRY_RUN}" == true ]]; then
		echo "[dry-run] Would delete ${key} (age $(age_days "${object_epoch}")d)"
	else
		echo "Deleting ${key} (age $(age_days "${object_epoch}")d)"
		if ! aws s3 rm "s3://${R2_BACKUP_BUCKET}/${key}" --endpoint-url "${R2_ENDPOINT}"; then
			echo "Failed to delete ${key}" >&2
			exit 1
		fi
	fi
	deleted=$((deleted + 1))
done

echo "Retention complete. Kept: ${kept}, Deleted: ${deleted}, Dry run: ${DRY_RUN}"
