#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Build the documentation site, prove the preview server is serving that exact
# build, then run the apps/site Playwright accessibility suites against it.
#
# Used as the `test-command` of lgtm-ci's reusable-test-e2e-playwright
# (.github/workflows/test-e2e-site.yml). The reusable owns bun install, the
# Chromium download/cache, the report artifact and the PR summary; it has no
# build stage and no notion of "is the server serving the right thing", so both
# happen here. Extra arguments (the reusable appends `--reporter` flags) are
# forwarded to `playwright test`.
#
# Why the server is started here instead of by Playwright's `webServer`: the
# staleness guard has to talk to the running server *before* the suite starts,
# which is only possible from outside Playwright. playwright.config.ts opts into
# reuse only when PLAYWRIGHT_REUSE_SERVER=1, which this script sets after the
# guard has passed.
#
# The build stamp (dist/e2e-build-stamp.txt, served at /e2e-build-stamp.txt):
#   fingerprint - sha256 over every file in dist/ except the stamp itself; ties
#                 the stamp to this build's bytes
#   commit      - the commit under test
#   run         - run id/attempt (or "local"), plus the build timestamp, so two
#                 byte-identical builds still produce distinct stamps and a
#                 server left over from an earlier run cannot match by accident
#
# Two independent checks, because they catch different failures:
#   1. freshness - dist/ must have been written by *this* invocation, so a
#      restored cache or a skipped build cannot masquerade as a build
#   2. served identity - assert-served-build.sh, before and after the suite, so
#      a green run is always attributable to the build that was stamped
set -euo pipefail

# The reusable appends `--reporter=html --reporter=json`, but Playwright's CLI
# keeps only the last `--reporter`, which would drop the HTML report the
# workflow uploads on failure. Collapse repeated flags into one value.
playwright_args=()
reporters=()
for arg in "$@"; do
	case "${arg}" in
	--reporter=*) reporters+=("${arg#--reporter=}") ;;
	*) playwright_args+=("${arg}") ;;
	esac
done
if [[ ${#reporters[@]} -gt 0 ]]; then
	joined="$(
		IFS=,
		echo "${reporters[*]}"
	)"
	playwright_args=("--reporter=${joined}" ${playwright_args[@]+"${playwright_args[@]}"})
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SITE_DIR="${ROOT}/apps/site"

set -a
# shellcheck disable=SC1091 # defaults.env is resolved via SCRIPT_DIR; not a static shellcheck input
source "${SCRIPT_DIR}/defaults.env"
set +a

ASTRO_BASE="${ASTRO_BASE:-${ASTRO_BASE_DEFAULT}}"
export ASTRO_BASE

# Must match playwright.config.ts, which defaults to 4321 and forwards E2E_PORT.
E2E_PORT="${E2E_PORT:-4321}"
export E2E_PORT

STAMP_NAME="e2e-build-stamp.txt"
STAMP_FILE="${SITE_DIR}/dist/${STAMP_NAME}"
# ASTRO_BASE is "/" today but may become a subpath; build the URL from it
# rather than assuming the site is served at the root.
STAMP_URL="http://127.0.0.1:${E2E_PORT}${ASTRO_BASE%/}/${STAMP_NAME}"

SERVER_LOG="$(mktemp)"
SERVER_PID=""
SERVER_IS_GROUP_LEADER=0

# shellcheck disable=SC2329 # invoked indirectly by the EXIT trap below
cleanup() {
	if [[ -n "${SERVER_PID}" ]]; then
		# Under setsid the server leads its own process group, so signalling
		# the group takes the whole `bun -> astro preview` tree down. Without
		# it, only the pid can be signalled safely — the script's own group
		# must never be the target.
		if ((SERVER_IS_GROUP_LEADER)); then
			kill -- "-${SERVER_PID}" 2>/dev/null || true
		fi
		kill "${SERVER_PID}" 2>/dev/null || true
		wait "${SERVER_PID}" 2>/dev/null || true
	fi
	rm -f "${SERVER_LOG}"
}
trap cleanup EXIT

dump_server_log() {
	echo "----- site preview server log -----" >&2
	cat "${SERVER_LOG}" >&2 || true
	echo "-----------------------------------" >&2
}

# GNU coreutils on the runners, BSD shasum for local macOS runs.
sha256_cmd=(sha256sum)
if ! command -v sha256sum >/dev/null 2>&1; then
	sha256_cmd=(shasum -a 256)
fi

file_mtime() {
	# GNU coreutils first (CI runners), BSD stat second (local macOS runs).
	stat -c %Y "$1" 2>/dev/null || stat -f %m "$1"
}

cd "${SITE_DIR}"

build_started="$(date +%s)"

echo "::group::Build site"
"${SCRIPT_DIR}/build.sh"
echo "::endgroup::"

# 1. Freshness: the build must have produced these files just now. A restored
#    cache, a no-op build or a hand-copied dist/ is exactly the "silently stale"
#    input turbo-themes#824 shipped a green suite against.
for required in dist/index.html dist/pagefind/pagefind.js; do
	if [[ ! -f "${required}" ]]; then
		echo "::error::${required} is missing after the site build" >&2
		exit 1
	fi
	if (($(file_mtime "${required}") < build_started)); then
		echo "::error::STALE BUILD: ${required} predates this job's build step — dist/ was not rebuilt" >&2
		exit 1
	fi
done

# 2. Stamp the build so the server can be asked what it is serving.
fingerprint="$(
	find dist -type f ! -name "${STAMP_NAME}" -print0 |
		LC_ALL=C sort -z |
		xargs -0 "${sha256_cmd[@]}" |
		"${sha256_cmd[@]}" |
		cut -d' ' -f1
)"
{
	echo "fingerprint=${fingerprint}"
	echo "commit=${GITHUB_SHA:-$(git -C "${ROOT}" rev-parse HEAD)}"
	echo "run=${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-${build_started}"
} >"${STAMP_FILE}"
echo "Build stamp: ${fingerprint}"

# 3. Serve the prebuilt dist/. E2E_SITE_PREBUILT=1 tells e2e-build.mjs to skip
#    the rebuild (it still asserts the artifacts exist and that the port is
#    free, so no foreign server can displace this one).
if command -v setsid >/dev/null 2>&1; then
	E2E_SITE_PREBUILT=1 setsid bun run e2e:server >"${SERVER_LOG}" 2>&1 &
	SERVER_PID=$!
	SERVER_IS_GROUP_LEADER=1
else
	E2E_SITE_PREBUILT=1 bun run e2e:server >"${SERVER_LOG}" 2>&1 &
	SERVER_PID=$!
fi

echo "::group::Verify served build"
if ! "${SCRIPT_DIR}/assert-served-build.sh" "${STAMP_URL}" "${STAMP_FILE}"; then
	dump_server_log
	exit 1
fi
echo "::endgroup::"

status=0
PLAYWRIGHT_REUSE_SERVER=1 bunx playwright test \
	${playwright_args[@]+"${playwright_args[@]}"} || status=$?

# 4. Re-verify after the suite. If the server died, or something else took over
#    the port mid-run, the result cannot be attributed to the stamped build —
#    and an unattributable green is the exact outcome this job exists to
#    prevent, so it fails even when Playwright itself was happy.
echo "::group::Re-verify served build"
if ! SERVED_BUILD_TIMEOUT_SECONDS=10 \
	"${SCRIPT_DIR}/assert-served-build.sh" "${STAMP_URL}" "${STAMP_FILE}"; then
	echo "::error::The site server no longer serves the build under test — the suite result cannot be attributed to it" >&2
	dump_server_log
	exit 1
fi
echo "::endgroup::"

exit "${status}"
