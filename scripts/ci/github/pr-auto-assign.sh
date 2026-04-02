#!/usr/bin/env bash
# Assign a random CODEOWNER to a pull request
# Usage: pr-auto-assign.sh
#
# Required environment variables:
#   GH_TOKEN        - GitHub token for gh CLI
#   PR_NUMBER       - Pull request number to assign
#
# Optional environment variables:
#   PR_AUTHOR_TYPE  - GitHub user type (e.g. "User", "Bot")

set -euo pipefail

# Fail early with clear messages instead of cryptic set -u errors
if [[ -z "${GH_TOKEN:-}" ]]; then
	echo "Error: GH_TOKEN is not set" >&2
	exit 1
fi
if [[ -z "${PR_NUMBER:-}" ]]; then
	echo "Error: PR_NUMBER is not set" >&2
	exit 1
fi

CODEOWNERS_FILE=".github/CODEOWNERS"

if [[ ! -f "$CODEOWNERS_FILE" ]]; then
	echo "Error: CODEOWNERS file not found at $CODEOWNERS_FILE" >&2
	echo "Check sparse-checkout configuration or file path." >&2
	exit 1
fi

# Parse CODEOWNERS: skip comments/blank lines, extract owner columns (fields
# after the pattern), keep only individual users (no org/team entries with /)
owners=""
pipeline_output=$(awk '
  /^[[:space:]]*(#|$)/ { next }
  {
    for (i = 2; i <= NF; i++) {
      owner = $i
      sub(/^@/, "", owner)
      if (owner !~ /\// && owner ~ /^[A-Za-z0-9_-]+$/) print owner
    }
  }
' "$CODEOWNERS_FILE" | sort -u) &&
	exit_code=0 || exit_code=$?

if [[ $exit_code -eq 0 ]]; then
	owners="$pipeline_output"
elif [[ $exit_code -eq 1 ]]; then
	# awk/sort exit code 1 means no matches - expected when no individual owners
	echo "No matches found in pipeline, treating as empty result"
	owners=""
else
	# Any other exit code indicates an actual error
	echo "Error: Pipeline failed with exit code $exit_code"
	exit "$exit_code"
fi

if [[ -z "$owners" ]]; then
	echo "No valid individual CODEOWNERS found, skipping assignment"
	exit 0
fi

# Convert to array using mapfile (shellcheck-safe)
mapfile -t owner_array <<<"$owners"
count=${#owner_array[@]}

random_index=$((RANDOM % count))
selected="${owner_array[$random_index]}"

echo "Selected assignee: $selected (from $count CODEOWNERS)"
gh pr edit "$PR_NUMBER" --add-assignee "$selected"

# Request a review from the selected CODEOWNER for bot-authored PRs
# (e.g. version bumps, Renovate dependency updates)
if [[ "${PR_AUTHOR_TYPE:-}" == "Bot" ]]; then
	echo "Bot-authored PR detected, requesting review from $selected"
	gh pr edit "$PR_NUMBER" --add-reviewer "$selected"
fi
