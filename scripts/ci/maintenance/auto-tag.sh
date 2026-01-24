#!/usr/bin/env bash
set -euo pipefail

# auto-tag.sh
# Unified script for auto-tagging releases.
#
# Usage:
#   scripts/ci/maintenance/auto-tag.sh <command>
#
# Commands:
#   read-version      Read version from Cargo.toml
#   detect-previous   Detect previous version from git tags
#   check-exists      Check if tag already exists
#   configure-auth    Configure git auth for push
#   create-push       Create and push the tag

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Unified script for auto-tagging releases.

Usage:
  scripts/ci/maintenance/auto-tag.sh <command>

Commands:
  read-version      Read version from Cargo.toml
  detect-previous   Detect previous version from git tags
  check-exists      Check if tag already exists
  configure-auth    Configure git auth for push
  create-push       Create and push the tag

Environment:
  TAG               Tag name (e.g., v0.1.0) - required for check-exists, create-push
  GITHUB_TOKEN      Token for push auth - required for configure-auth
  GITHUB_REPOSITORY Repository in owner/repo format - required for configure-auth
  GITHUB_OUTPUT     GitHub Actions output file
EOF
	exit 0
fi

COMMAND="${1:-}"

case "$COMMAND" in
read-version)
	# Use cargo metadata for reliable version extraction in workspace scenarios
	if command -v cargo &>/dev/null && command -v jq &>/dev/null; then
		VERSION=$(cargo metadata --format-version=1 --no-deps 2>/dev/null | jq -r '.packages[0].version' || true)
	fi
	# Fallback to grep if cargo metadata fails or isn't available
	if [[ -z "${VERSION:-}" ]]; then
		VERSION=$(grep -m1 '^version = ' Cargo.toml | sed 's/version = "\(.*\)"/\1/')
	fi
	echo "version=$VERSION" >>"$GITHUB_OUTPUT"
	echo "Detected version: $VERSION"
	;;

detect-previous)
	# Get the most recent tag
	PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
	if [[ -n "$PREV_TAG" ]]; then
		PREV_VERSION="${PREV_TAG#v}"
		echo "version=$PREV_VERSION" >>"$GITHUB_OUTPUT"
		echo "Previous version: $PREV_VERSION"
	else
		echo "version=" >>"$GITHUB_OUTPUT"
		echo "No previous version found"
	fi
	;;

check-exists)
	if [[ -z "${TAG:-}" ]]; then
		echo "TAG environment variable is required" >&2
		exit 1
	fi
	if git rev-parse "$TAG" >/dev/null 2>&1; then
		echo "exists=true" >>"$GITHUB_OUTPUT"
		echo "Tag $TAG already exists"
	else
		echo "exists=false" >>"$GITHUB_OUTPUT"
		echo "Tag $TAG does not exist"
	fi
	;;

configure-auth)
	if [[ -z "${GITHUB_TOKEN:-}" ]]; then
		echo "GITHUB_TOKEN environment variable is required" >&2
		exit 1
	fi
	if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
		echo "GITHUB_REPOSITORY environment variable is required" >&2
		exit 1
	fi
	git config user.name "github-actions[bot]"
	git config user.email "github-actions[bot]@users.noreply.github.com"
	# Use credential helper to avoid token in URL (defense-in-depth)
	# shellcheck disable=SC2016  # Single quotes intentional - variable evaluated by credential helper at runtime
	git config credential.helper '!f() { echo "password=${GITHUB_TOKEN}"; }; f'
	git remote set-url origin "https://github-actions[bot]@github.com/${GITHUB_REPOSITORY}.git"
	echo "Git auth configured"
	;;

create-push)
	if [[ -z "${TAG:-}" ]]; then
		echo "TAG environment variable is required" >&2
		exit 1
	fi
	git tag -a "$TAG" -m "Release $TAG"
	if ! git push origin "$TAG"; then
		echo "❌ Failed to push tag $TAG to remote" >&2
		# Clean up local tag to keep state consistent
		git tag -d "$TAG" 2>/dev/null || true
		exit 1
	fi
	# Verify tag exists on remote
	if git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
		echo "✅ Created and pushed tag $TAG"
	else
		echo "⚠️ Tag push succeeded but remote verification failed" >&2
		exit 1
	fi
	;;

*)
	echo "Unknown command: $COMMAND" >&2
	echo "Use --help for usage information" >&2
	exit 1
	;;
esac
