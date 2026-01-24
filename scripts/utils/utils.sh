#!/usr/bin/env bash

# Shared utilities for workflow scripts
# This file contains common functions and variables used across multiple scripts

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Common exclude directories for lintro
# shellcheck disable=SC2034  # Variable used by scripts that source this file
EXCLUDE_DIRS=".git,target,node_modules,.venv,venv"

# Common environment variables
GITHUB_SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_RUN_ID="${GITHUB_RUN_ID:-}"
GITHUB_SHA="${GITHUB_SHA:-}"

# Function to check if we're in a PR context
# Handles both pull_request and pull_request_target events
is_pr_context() {
	local event="${GITHUB_EVENT_NAME:-}"
	[ "$event" = "pull_request" ] || [ "$event" = "pull_request_target" ]
}

# Function to log messages with colors
log_info() {
	echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
	echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
	echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
	echo -e "${RED}❌ $1${NC}"
}

log_verbose() {
	[ "${VERBOSE:-0}" -eq 1 ] && echo -e "${BLUE}[verbose] $1${NC}" || true
}

# Function to generate PR comment file
# Arguments:
#   $1 - title: The title of the PR comment
#   $2 - status: Status indicator (e.g., "✅ PASSED")
#   $3 - content: Main content of the comment
#   $4 - output_file: File to write the comment to
#   $5 - tool_name: (optional) Name of the tool for the footer (default: "lintro")
generate_pr_comment() {
	local title="$1"
	local status="$2"
	local content="$3"
	local output_file="$4"
	local tool_name="${5:-lintro}"

	# Build the comment with optional build link
	local build_link=""
	if [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
		build_link="
---
🔗 **[View full build details]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID)**"
	fi

	local comment="## $title

This PR has been analyzed using **$tool_name**.

### 📊 Status: $status

$content
$build_link

*This analysis was performed automatically by the CI pipeline.*"

	echo "$comment" >"$output_file"
	log_success "PR comment generated and saved to $output_file"
}

# =============================================================================
# GitHub Actions Integration Functions
# =============================================================================

# Configure git user for CI commits (github-actions[bot])
configure_git_ci_user() {
	git config user.name "github-actions[bot]"
	git config user.email "github-actions[bot]@users.noreply.github.com"
}

# Set a GitHub Actions output variable
# Usage: set_github_output "key" "value"
set_github_output() {
	local key="$1"
	local value="$2"
	if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
		echo "$key=$value" >>"$GITHUB_OUTPUT"
	fi
}

# Set a GitHub Actions environment variable
# Usage: set_github_env "key" "value"
set_github_env() {
	local key="$1"
	local value="$2"
	if [[ -n "${GITHUB_ENV:-}" ]]; then
		echo "$key=$value" >>"$GITHUB_ENV"
	fi
}

# =============================================================================
# Utility Functions
# =============================================================================

# Array to track temp directories for cleanup
_TEMP_DIRS=()

_cleanup_temp_dirs() {
	for dir in "${_TEMP_DIRS[@]}"; do
		rm -rf "$dir"
	done
}

# Register cleanup trap once when sourced
trap _cleanup_temp_dirs EXIT

# Create a temporary directory with automatic cleanup on exit
# Usage: tmpdir=$(create_temp_dir)
# Note: Multiple calls accumulate directories; all are cleaned up on exit
create_temp_dir() {
	local tmpdir
	tmpdir=$(mktemp -d)
	_TEMP_DIRS+=("$tmpdir")
	echo "$tmpdir"
}

# Display standardized help message
# Usage: show_help "script_name" "description" "usage_pattern"
show_help() {
	local script_name="$1"
	local description="$2"
	local usage="${3:-}"
	cat <<EOF
Usage: $script_name $usage

$description

Options:
  --help, -h    Show this help message
EOF
}
