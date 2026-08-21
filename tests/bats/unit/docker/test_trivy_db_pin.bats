#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Guard the #851 Trivy DB pin so scans do not use mirror.gcr.io.

bats_require_minimum_version 1.5.0

load "../../helpers/common"

WORKFLOW="${PROJECT_ROOT}/.github/workflows/docker-build-publish.yml"
RERUN="${PROJECT_ROOT}/.github/workflows/auto-rerun-on-infra-failure.yml"

@test "post-merge Vulnerability Scan pins Trivy DB to ghcr.io" {
	run grep -F "TRIVY_DB_REPOSITORY: ghcr.io/aquasecurity/trivy-db" "${WORKFLOW}"
	assert_success
	run grep -F "TRIVY_JAVA_DB_REPOSITORY: ghcr.io/aquasecurity/trivy-java-db" \
		"${WORKFLOW}"
	assert_success
}

@test "reusable Trivy is PR-only so the GCR-mirror job does not run on main" {
	run grep -F "scan: \${{ github.event_name == 'pull_request' }}" "${WORKFLOW}"
	assert_success
}

@test "Trivy SARIF upload is skipped when the scanner produced no file" {
	run grep -F "hashFiles('trivy-results.sarif')" "${WORKFLOW}"
	assert_success
}

@test "Auto Rerun knows the Trivy GCR-mirror 404 signature" {
	run grep -F "mirror.gcr.io/aquasec/trivy-db" "${RERUN}"
	assert_success
	run grep -F "failed to download vulnerability DB" "${RERUN}"
	assert_success
}
