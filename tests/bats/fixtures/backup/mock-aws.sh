#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only

service="${1:-}"
subcommand="${2:-}"
shift 2 || true

case "${service}:${subcommand}" in
s3:cp)
	dest=""
	endpoint=""
	while (($# > 0)); do
		case "$1" in
		--endpoint-url)
			endpoint="$2"
			shift 2
			;;
		s3://*)
			dest="$1"
			shift
			;;
		*)
			shift
			;;
		esac
	done

	if [[ -z "${endpoint}" ]]; then
		echo "aws s3 cp requires --endpoint-url in tests" >&2
		exit 1
	fi

	if [[ "${MOCK_AWS_UPLOAD_FAIL:-0}" == "1" ]]; then
		echo "upload failed" >&2
		exit 1
	fi

	if [[ -n "${MOCK_AWS_UPLOAD_LOG:-}" ]]; then
		echo "${dest}" >>"${MOCK_AWS_UPLOAD_LOG}"
	fi
	exit 0
	;;
s3:ls)
	endpoint=""
	while (($# > 0)); do
		case "$1" in
		--endpoint-url)
			endpoint="$2"
			shift 2
			;;
		*)
			shift
			;;
		esac
	done

	if [[ -z "${endpoint}" ]]; then
		echo "aws s3 ls requires --endpoint-url in tests" >&2
		exit 1
	fi

	if [[ "${MOCK_AWS_LS_FAIL:-0}" == "1" ]]; then
		echo "list failed" >&2
		exit 1
	fi

	if [[ -n "${MOCK_AWS_LS_FILE:-}" && -f "${MOCK_AWS_LS_FILE}" ]]; then
		cat "${MOCK_AWS_LS_FILE}"
	fi
	exit 0
	;;
s3:rm)
	key=""
	endpoint=""
	while (($# > 0)); do
		case "$1" in
		--endpoint-url)
			endpoint="$2"
			shift 2
			;;
		s3://*)
			key="$1"
			shift
			;;
		*)
			shift
			;;
		esac
	done

	if [[ -z "${endpoint}" ]]; then
		echo "aws s3 rm requires --endpoint-url in tests" >&2
		exit 1
	fi

	if [[ -n "${MOCK_AWS_DELETE_LOG:-}" ]]; then
		key="${key#s3://*/}"
		echo "${key}" >>"${MOCK_AWS_DELETE_LOG}"
	fi
	exit 0
	;;
*)
	echo "unsupported aws mock command: ${service} ${subcommand}" >&2
	exit 1
	;;
esac
