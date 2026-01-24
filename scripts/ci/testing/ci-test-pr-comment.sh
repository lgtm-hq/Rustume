#!/usr/bin/env bash
set -euo pipefail

# Show help if requested
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
	echo "Usage: $0 [--help|-h]"
	echo ""
	echo "CI Test PR Comment Script"
	echo "Generates a PR comment from test-output.txt within a GitHub Actions run."
	echo ""
	echo "Environment variables:"
	echo "  TEST_EXIT_CODE  Exit code from test run (used to determine pass/fail status)"
	echo ""
	echo "This script is intended for CI and will no-op outside pull_request events."
	exit 0
fi

# CI Test PR Comment Script
# Generates and posts comments to PRs with test results

# Source shared utilities
# shellcheck source=../../utils/utils.sh disable=SC1091
source "$(dirname "$0")/../../utils/utils.sh"

# Check if we're in a PR context
if ! is_pr_context; then
	log_info "Not in a PR context, skipping comment generation"
	exit 0
fi

# Read the test output and derive status from exit code
if [ -f test-output.txt ]; then
	# Extract test summary
	OUTPUT=$(grep -E "^test result:|running [0-9]+ test|^failures:" test-output.txt 2>/dev/null || cat test-output.txt)
else
	OUTPUT="❌ Test run failed - check the CI logs for details"
fi

# Trust the recorded exit code to determine status
if [ "${TEST_EXIT_CODE:-1}" != "0" ]; then
	STATUS="⚠️ TESTS FAILED"
else
	STATUS="✅ ALL TESTS PASSED"
fi

# Create the comment content with marker
CONTENT="<!-- test-report -->

**Workflow:**
1. 🔨 Built workspace with \`cargo build\`
2. 🧪 Ran tests with \`cargo test --workspace --all-features\`

### 📋 Results:
\`\`\`
$OUTPUT
\`\`\`"

# Generate PR comment using shared function with appropriate tool name
generate_pr_comment "🧪 Rust Test Results" "$STATUS" "$CONTENT" "test-pr-comment.txt" "cargo test"
