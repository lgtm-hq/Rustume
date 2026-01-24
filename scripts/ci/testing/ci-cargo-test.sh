#!/usr/bin/env bash

# CI Cargo Test Script
# Handles running cargo test for CI pipeline with GitHub Actions integration

set -e

# Show help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
	echo "Usage: $0 [--help]"
	echo ""
	echo "CI Cargo Test Script"
	echo "Runs cargo test for CI pipeline with GitHub Actions integration."
	echo ""
	echo "Features:"
	echo "  - Runs cargo test with all features"
	echo "  - Generates GitHub Actions summaries"
	echo "  - Stores exit code for PR comment step"
	echo ""
	echo "Environment variables:"
	echo "  TEST_EXIT_CODE  Set in GITHUB_ENV for downstream steps"
	echo ""
	echo "This script is designed to be run in GitHub Actions CI environment."
	exit 0
fi

# Source shared utilities
# SC1091: path is dynamically constructed, file exists at runtime
# shellcheck disable=SC1091
source "$(dirname "$0")/../../utils/utils.sh"

# Set up step summary if not in GitHub Actions
GITHUB_STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
GITHUB_ENV="${GITHUB_ENV:-/dev/null}"

# Track whether we've written the exit code
_EXIT_CODE_WRITTEN=false

# Ensure TEST_EXIT_CODE is always set, even on early exit
_write_exit_code() {
	if [ "$_EXIT_CODE_WRITTEN" = false ]; then
		echo "TEST_EXIT_CODE=${TEST_EXIT_CODE:-1}" >>"$GITHUB_ENV"
		_EXIT_CODE_WRITTEN=true
	fi
}
trap _write_exit_code EXIT

{
	echo "## 🧪 Rust Test Suite"
	echo ""
	echo "### Running Tests"
	echo "Running \`cargo test --workspace --all-features\`..."
	echo ""
} >>"$GITHUB_STEP_SUMMARY"

# Run cargo test
set +e # Don't exit on error
cargo test --workspace --all-features 2>&1 | tee test-output.txt
TEST_EXIT_CODE=${PIPESTATUS[0]}
set -e # Exit on error again

{
	echo "### 📊 Test Results:"
	echo '```'
	if [ -f test-output.txt ]; then
		# Extract just the summary lines
		grep -E "^test result:|running [0-9]+ test|^failures:" test-output.txt || cat test-output.txt
	else
		echo "No test output captured"
	fi
	echo '```'
	echo ""
	echo "**Test exit code:** $TEST_EXIT_CODE"
	echo ""
} >>"$GITHUB_STEP_SUMMARY"

if [ ! -f test-output.txt ]; then
	echo "No test output captured" >test-output.txt
fi

# Store the exit code and clear the trap
_write_exit_code
trap - EXIT

if [ "$TEST_EXIT_CODE" -eq 0 ]; then
	log_success "Cargo test completed successfully"
else
	log_info "Cargo test completed with exit code $TEST_EXIT_CODE"
fi

# Exit with the test exit code
exit "$TEST_EXIT_CODE"
