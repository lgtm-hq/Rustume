#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Flatten lgtm-ci reusable-test-node coverage artifact for Model B Pages bundling.
#
# Expects actions/download-artifact to have extracted node-coverage-<version>/
# (see lgtm-ci scripts/ci/actions/stage-node-coverage.sh). Copies the Vitest HTML
# tree to web-coverage-html/ at repo root for upload as web-coverage-html.
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22}"
WORKING_DIRECTORY="${WORKING_DIRECTORY:-apps/web}"
STAGING_DIR="${WEB_COVERAGE_HTML_DIR:-web-coverage-html}"
SOURCE_ROOT="node-coverage-${NODE_VERSION}/${WORKING_DIRECTORY}/coverage"

if [[ ! -d "${SOURCE_ROOT}" ]]; then
	echo "Missing ${SOURCE_ROOT}; ensure reusable-test-node uploaded node-coverage-${NODE_VERSION}." >&2
	exit 1
fi

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"
cp -a "${SOURCE_ROOT}/." "${STAGING_DIR}/"
echo "Staged ${SOURCE_ROOT} -> ${STAGING_DIR}/"
