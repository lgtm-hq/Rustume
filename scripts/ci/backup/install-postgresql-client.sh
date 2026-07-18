#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
set -euo pipefail

# Install postgresql-client on Ubuntu runners for pg_dump.

while (($# > 0)); do
	case "$1" in
	--help | -h)
		sed -n '1,12p' "$0"
		exit 0
		;;
	*)
		echo "Unknown argument: $1" >&2
		exit 2
		;;
	esac
done

sudo apt-get update
sudo apt-get install -y postgresql-client
