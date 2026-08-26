#!/usr/bin/env bats
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Tests for scripts/ci/maintenance/check-tooling-ref-sync.sh

load "../../helpers/common"

CHECK_SYNC="${PROJECT_ROOT}/scripts/ci/maintenance/check-tooling-ref-sync.sh"

SHA_A="31c25ef2e8992960e218524780e34f44f51271b5"
SHA_B="66cad82ead0e5d119928c895c7d7da9c837989e5"

setup() {
	WORKFLOW_DIR="${BATS_TEST_TMPDIR}/workflows"
	mkdir -p "${WORKFLOW_DIR}"
}

# Writes a caller workflow: $1 file, $2 uses sha, $3 uses version,
# $4 tooling-ref sha, $5 tooling-ref version.
write_caller() {
	cat >"${WORKFLOW_DIR}/$1" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@$2 # $3
    with:
      tooling-ref: '$4' # $5
EOF
}

run_guard() {
	run bash "${CHECK_SYNC}" "${WORKFLOW_DIR}"
}

@test "pin sync: matching tooling-ref and uses pins pass" {
	write_caller "a.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"
	write_caller "b.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"

	run_guard

	assert_success
	assert_output --partial "pin sync guard passed"
	assert_output --partial "2 tooling-ref pin(s)"
}

@test "pin sync: tooling-ref SHA differing from uses SHA fails" {
	write_caller "a.yml" "${SHA_A}" "v0.54.0" "${SHA_B}" "v0.54.0"

	run_guard

	assert_failure
	assert_output --partial "pin drift detected"
	assert_output --partial "does not match any 'uses:' pin"
}

@test "pin sync: mismatched version comment fails even when SHAs agree" {
	write_caller "a.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.52.3"

	run_guard

	assert_failure
	assert_output --partial "does not match any 'uses:' pin"
}

@test "pin sync: workflows on different lgtm-ci releases fail" {
	write_caller "a.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"
	write_caller "b.yml" "${SHA_B}" "v0.52.3" "${SHA_B}" "v0.52.3"

	run_guard

	assert_failure
	assert_output --partial "more than one version"
	assert_output --partial "${SHA_B}"
}

@test "pin sync: ai-review.yml may pin a newer lgtm-ci than the rest" {
	write_caller "quality.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"
	write_caller "ai-review.yml" "${SHA_B}" "v0.67.0" "${SHA_B}" "v0.67.0"

	run_guard

	assert_success
	assert_output --partial "pin sync guard passed"
	assert_output --partial "2 tooling-ref pin(s)"
}

@test "pin sync: a non-ai-review file still cannot diverge when ai-review.yml is present" {
	write_caller "quality.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"
	write_caller "coverage.yml" "${SHA_B}" "v0.52.3" "${SHA_B}" "v0.52.3"
	write_caller "ai-review.yml" "${SHA_B}" "v0.67.0" "${SHA_B}" "v0.67.0"

	run_guard

	assert_failure
	assert_output --partial "more than one version"
	assert_output --partial "excluding ai-review.yml"
	assert_output --partial "${SHA_B}"
}

@test "pin sync: pins inside ai-review.yml must still agree with each other" {
	cat >"${WORKFLOW_DIR}/ai-review.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-ai-review.yml@${SHA_A} # v0.67.0
    with:
      tooling-ref: '${SHA_B}' # v0.67.0
EOF

	run_guard

	assert_failure
	assert_output --partial "does not match any 'uses:' pin"
}

@test "pin sync: straggler with only a uses pin is still caught repo-wide" {
	write_caller "a.yml" "${SHA_A}" "v0.54.0" "${SHA_A}" "v0.54.0"
	cat >"${WORKFLOW_DIR}/inline.yml" <<EOF
jobs:
  inline:
    steps:
      - uses: lgtm-hq/lgtm-ci/.github/actions/secure-checkout@${SHA_B} # v0.52.3
EOF

	run_guard

	assert_failure
	assert_output --partial "more than one version"
}

@test "pin sync: tooling-ref without an lgtm-ci uses pin fails" {
	cat >"${WORKFLOW_DIR}/orphan.yml" <<EOF
jobs:
  call:
    uses: other-org/other-ci/.github/workflows/thing.yml@${SHA_A} # v1.0.0
    with:
      tooling-ref: '${SHA_A}' # v0.54.0
EOF

	run_guard

	assert_failure
	assert_output --partial "no lgtm-ci 'uses:' pin"
}

@test "pin sync: double-quoted and unquoted tooling-ref scalars are checked" {
	cat >"${WORKFLOW_DIR}/quoted.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: "${SHA_A}" # v0.54.0
EOF
	cat >"${WORKFLOW_DIR}/bare.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: ${SHA_A} # v0.54.0
EOF

	run_guard

	assert_success
	assert_output --partial "2 tooling-ref pin(s)"
}

@test "pin sync: drift in a double-quoted tooling-ref is still caught" {
	cat >"${WORKFLOW_DIR}/quoted.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: "${SHA_B}" # v0.54.0
EOF

	run_guard

	assert_failure
	assert_output --partial "does not match any 'uses:' pin"
}

@test "pin sync: an unparsable tooling-ref line is reported, not skipped" {
	cat >"${WORKFLOW_DIR}/odd.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: '${SHA_A}"
EOF

	run_guard

	assert_failure
	assert_output --partial "unparsable tooling-ref line"
}

@test "pin sync: a tooling-ref without a version comment is reported" {
	cat >"${WORKFLOW_DIR}/nocomment.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: '${SHA_A}'
EOF

	run_guard

	assert_failure
	assert_output --partial "unparsable tooling-ref line"
}

@test "pin sync: trailing prose after the version comment is still parsed" {
	cat >"${WORKFLOW_DIR}/prose.yml" <<EOF
jobs:
  call:
    uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A} # v0.54.0
    with:
      tooling-ref: '${SHA_A}' # v0.54.0 release commit
EOF

	run_guard

	assert_success
	assert_output --partial "1 tooling-ref pin(s)"
}

@test "pin sync: a quoted lgtm-ci uses pin is recognized" {
	cat >"${WORKFLOW_DIR}/quoted-uses.yml" <<EOF
jobs:
  call:
    uses: "lgtm-hq/lgtm-ci/.github/workflows/reusable-thing.yml@${SHA_A}" # v0.54.0
    with:
      tooling-ref: '${SHA_A}' # v0.54.0
EOF

	run_guard

	assert_success
	assert_output --partial "1 tooling-ref pin(s)"
}

@test "pin sync: workflows without lgtm-ci pins pass" {
	cat >"${WORKFLOW_DIR}/plain.yml" <<'EOF'
jobs:
  plain:
    steps:
      - run: echo hello
EOF

	run_guard

	assert_success
	assert_output --partial "0 tooling-ref pin(s)"
}

@test "pin sync: the repo's own workflows are in sync" {
	run bash "${CHECK_SYNC}" "${PROJECT_ROOT}/.github/workflows"

	assert_success
	assert_output --partial "pin sync guard passed"
}

@test "pin sync: missing workflow directory exits 2" {
	run bash "${CHECK_SYNC}" "${BATS_TEST_TMPDIR}/nope"

	assert_failure
	assert_equal "${status}" "2"
	assert_output --partial "Workflow directory not found"
}

@test "pin sync: --help prints usage" {
	run bash "${CHECK_SYNC}" --help

	assert_success
	assert_output --partial "check-tooling-ref-sync.sh"
	assert_output --partial "Usage:"
}
