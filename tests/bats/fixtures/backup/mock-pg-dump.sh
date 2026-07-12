#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only

while (($# > 0)); do
	case "$1" in
	-Fc)
		shift
		;;
	*)
		shift
		;;
	esac
done

if [[ "${MOCK_PG_DUMP_EMPTY:-0}" == "1" ]]; then
	exit 0
fi

printf 'PGDMP'
exit 0
