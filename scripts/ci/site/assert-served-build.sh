#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Staleness guard: assert the server answering <stamp-url> is serving the build
# under test, and not some older or unrelated site.
#
# turbo-themes#824 is the failure this exists for: a suite generated snapshots
# against a **stale** server and passed, so the green check meant nothing. A
# passing accessibility run over yesterday's build is worse than no run, so the
# contract here is fail-loud, never warn.
#
# The stamp is written into dist/ by e2e.sh immediately after the build (see
# that script for the field-by-field meaning). This script only compares what
# the server returns against the local copy, byte for byte:
#
#   * connection refused / no response  -> retried until the timeout, then fatal
#   * any non-200 (typically 404)       -> fatal immediately; something is
#                                          listening on that port but it is not
#                                          serving this build's dist/
#   * 200 with different content        -> fatal; a different build is being
#                                          served
#
# Complementary to apps/site/scripts/e2e-build.mjs, which refuses to start when
# the port is already busy (`astro preview` silently hops to the next free port
# otherwise). That check prevents *our* server from being displaced; this one
# proves the server that actually answers is serving *this* build.
#
# Usage: assert-served-build.sh <stamp-url> <expected-stamp-file>
#
# Optional environment:
#   SERVED_BUILD_TIMEOUT_SECONDS  - total wait for a first response (default 120)
#   SERVED_BUILD_POLL_SECONDS     - delay between attempts (default 2)
set -euo pipefail

STAMP_URL="${1:-}"
EXPECTED_FILE="${2:-}"

if [[ -z "${STAMP_URL}" || -z "${EXPECTED_FILE}" ]]; then
	echo "usage: assert-served-build.sh <stamp-url> <expected-stamp-file>" >&2
	exit 2
fi

TIMEOUT_SECONDS="${SERVED_BUILD_TIMEOUT_SECONDS:-120}"
POLL_SECONDS="${SERVED_BUILD_POLL_SECONDS:-2}"

fail() {
	echo "::error::$1"
	echo "assert-served-build: $1" >&2
	exit 1
}

if [[ ! -f "${EXPECTED_FILE}" ]]; then
	fail "expected stamp file not found: ${EXPECTED_FILE} (the build did not write one)"
fi

body_file="$(mktemp)"
trap 'rm -f "${body_file}"' EXIT

deadline=$((SECONDS + TIMEOUT_SECONDS))
status=""
while :; do
	status="$(
		curl --silent --show-error --max-time 10 --output "${body_file}" \
			--write-out '%{http_code}' "${STAMP_URL}" 2>/dev/null || true
	)"

	# 000 means the request never completed (nothing listening yet, or the
	# server is still coming up) — that is the only retryable outcome.
	if [[ "${status}" != "000" ]]; then
		break
	fi
	if ((SECONDS >= deadline)); then
		fail "no response from ${STAMP_URL} after ${TIMEOUT_SECONDS}s — the site server never came up"
	fi
	sleep "${POLL_SECONDS}"
done

if [[ "${status}" != "200" ]]; then
	fail "STALE OR FOREIGN SERVER: ${STAMP_URL} returned HTTP ${status}; the process on that port is not serving this build's dist/"
fi

if ! diff -q "${EXPECTED_FILE}" "${body_file}" >/dev/null 2>&1; then
	echo "::error::STALE BUILD: the served site is not the build under test"
	{
		echo "assert-served-build: served build stamp does not match the build under test"
		echo "  url:      ${STAMP_URL}"
		echo "  expected: (${EXPECTED_FILE})"
		sed 's/^/    /' "${EXPECTED_FILE}"
		echo "  served:"
		head -c 2048 "${body_file}" | sed 's/^/    /'
		echo ""
	} >&2
	exit 1
fi

echo "assert-served-build: served build matches the build under test (${STAMP_URL})"
