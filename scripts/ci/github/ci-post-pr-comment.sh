#!/usr/bin/env bash

# CI Post PR Comment Script
# Handles posting comments to PRs using GitHub API

set -e

# Show help if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
	echo "Usage: $0 [--help] [COMMENT_FILE]"
	echo ""
	echo "CI Post PR Comment Script"
	echo "Handles posting comments to PRs using GitHub API."
	echo ""
	echo "Arguments:"
	echo "  COMMENT_FILE    Path to comment file (default: pr-comment.txt)"
	echo ""
	echo "Environment variables:"
	echo "  PR_NUMBER           PR number to comment on (required)"
	echo "  GITHUB_REPOSITORY   Repository in owner/repo format (required)"
	echo "  GITHUB_TOKEN        Token for API authentication (required)"
	echo "  MARKER              Optional HTML comment marker for update-in-place"
	echo ""
	echo "This script is designed to be run in GitHub Actions CI environment."
	exit 0
fi

# Source shared utilities
# SC1091: path is dynamically constructed, file exists at runtime
# shellcheck disable=SC1091
source "$(dirname "$0")/../../utils/utils.sh"

# Check if we're in a PR context
if ! is_pr_context; then
	log_info "Not in a PR context, skipping comment posting"
	exit 0
fi

# Validate required environment variables
if [ -z "${PR_NUMBER:-}" ]; then
	log_error "PR_NUMBER environment variable is required"
	exit 1
fi

if [ -z "${GITHUB_REPOSITORY:-}" ]; then
	log_error "GITHUB_REPOSITORY environment variable is required"
	exit 1
fi

# Validate GITHUB_TOKEN or GH_TOKEN is set (gh CLI uses either)
if [ -z "${GITHUB_TOKEN:-}" ] && [ -z "${GH_TOKEN:-}" ]; then
	log_error "GITHUB_TOKEN or GH_TOKEN environment variable is required"
	exit 1
fi

# Get the comment file from argument
COMMENT_FILE="${1:-pr-comment.txt}"

# Optional marker to enable merge-update behavior
MARKER="${MARKER:-}"

if [ ! -f "$COMMENT_FILE" ]; then
	log_error "Comment file $COMMENT_FILE not found"
	exit 1
fi

log_info "Preparing PR comment from $COMMENT_FILE"

# If a marker is provided, attempt to find an existing comment with that marker
# and update it instead of creating a new one.
if [ -n "$MARKER" ]; then
	log_info "Marker provided; attempting to update existing comment in-place"
	# Fetch existing comments via gh API
	if command -v gh &>/dev/null; then
		EXISTING_JSON=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate 2>/dev/null || echo "[]")

		# Use jq for reliable JSON parsing if available, otherwise fall back to grep
		if command -v jq &>/dev/null; then
			COMMENT_ID=$(echo "$EXISTING_JSON" | jq -r --arg marker "$MARKER" '.[] | select(.body | contains($marker)) | .id' | head -1 || true)
		else
			# Fallback to grep-based parsing
			COMMENT_ID=$(echo "$EXISTING_JSON" | grep -B5 "$MARKER" | grep '"id":' | head -1 | grep -oE '[0-9]+' || true)
		fi

		if [ -n "$COMMENT_ID" ]; then
			log_info "Found existing comment with marker (id=$COMMENT_ID); updating"
			gh api "repos/$GITHUB_REPOSITORY/issues/comments/$COMMENT_ID" \
				-X PATCH \
				-F body=@"$COMMENT_FILE" >/dev/null
			log_success "PR comment updated successfully"
			exit 0
		else
			log_info "No existing comment with marker; will create a new comment"
		fi
	fi
fi

log_info "Posting PR comment"

# Post PR comment using GitHub CLI
if command -v gh &>/dev/null; then
	if gh pr comment "$PR_NUMBER" --body-file "$COMMENT_FILE" >/dev/null 2>&1; then
		log_success "PR comment posted successfully via gh (pr comment)"
	else
		# Fallback to gh api with explicit body content
		if gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
			-f body="$(cat "$COMMENT_FILE")"; then
			log_success "PR comment posted successfully via gh api"
		else
			log_error "Failed to post PR comment via both methods"
			exit 1
		fi
	fi
else
	log_error "gh CLI not found"
	exit 1
fi
