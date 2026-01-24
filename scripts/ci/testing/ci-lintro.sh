#!/usr/bin/env bash

# CI Lintro Analysis Script
# Handles running lintro analysis for CI pipeline with GitHub Actions integration

set -e

# Show help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
	echo "Usage: $0 [--help]"
	echo ""
	echo "CI Lintro Analysis Script"
	echo "Runs Lintro analysis for CI pipeline with GitHub Actions integration."
	echo ""
	echo "Features:"
	echo "  - Runs Lintro check command"
	echo "  - Generates GitHub Actions summaries"
	echo "  - Stores exit code for PR comment step"
	echo ""
	echo "Environment variables:"
	echo "  CHK_EXIT_CODE  Set in GITHUB_ENV for downstream steps"
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

# Ensure CHK_EXIT_CODE is always set, even on early exit
_write_exit_code() {
	if [ "$_EXIT_CODE_WRITTEN" = false ]; then
		echo "CHK_EXIT_CODE=${CHK_EXIT_CODE:-1}" >>"$GITHUB_ENV"
		_EXIT_CODE_WRITTEN=true
	fi
}
trap _write_exit_code EXIT

{
	echo "## 🔧 Lintro Code Quality & Analysis"
	echo ""
	echo "### 🛠️ Step 1: Running Lintro Checks"
	echo "Running \`lintro check\` against the entire project..."
	echo ""
} >>"$GITHUB_STEP_SUMMARY"

# Run lintro check
set +e # Don't exit on error
lintro check . 2>&1 | tee chk-output.txt
CHK_EXIT_CODE=${PIPESTATUS[0]}
set -e # Exit on error again

{
	echo "### 📊 Linting Results:"
	echo '```'
	if [ -f chk-output.txt ]; then
		cat chk-output.txt
	else
		echo "No linting output captured"
	fi
	echo '```'
	echo ""
	echo "**Linting exit code:** $CHK_EXIT_CODE"
	echo ""
} >>"$GITHUB_STEP_SUMMARY"

if [ ! -f chk-output.txt ]; then
	echo "No linting output captured" >chk-output.txt
fi

# Store the exit code and clear the trap
_write_exit_code
trap - EXIT

{
	echo "### 📋 Summary"
	echo "- **Step 1:** Code quality checks performed with \`lintro check\`"
	echo ""
	echo "---"
	echo "🚀 **Lintro** provides a unified interface for multiple code quality tools!"
} >>"$GITHUB_STEP_SUMMARY"

if [ "$CHK_EXIT_CODE" -eq 0 ]; then
	log_success "Lintro analysis completed successfully"
else
	log_info "Lintro analysis completed with exit code $CHK_EXIT_CODE"
fi

# Exit with the check exit code
exit "$CHK_EXIT_CODE"
