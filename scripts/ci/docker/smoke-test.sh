#!/usr/bin/env bash
set -euo pipefail

# Functional smoke test for Rustume container images.
#
# Used as lgtm-ci reusable-docker `smoke-test-script`. The workflow sets:
#   IMAGE     - Local validate tag or registry digest reference
#   PLATFORM  - Target platform (e.g. linux/arm64)
#   REGISTRY  - Container registry URL
#
# Manual usage:
#   IMAGE=ghcr.io/lgtm-hq/rustume@sha256:... PLATFORM=linux/amd64 \
#     scripts/ci/docker/smoke-test.sh
#
# Environment:
#   IMAGE     - Image reference (required; positional arg 1 overrides)
#   PLATFORM  - Optional platform for docker pull/run (e.g. linux/arm64)
#   PORT      - Host port mapping (default: 3000)
#   TIMEOUT   - Health wait timeout seconds (default: 30)

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Functional smoke test for Rustume container images.

Usage:
  scripts/ci/docker/smoke-test.sh [IMAGE]

Environment:
  IMAGE     Image reference (required if not passed as arg)
  PLATFORM  Target platform for pull/run (optional)
  PORT      Host port (default: 3000)
  TIMEOUT   Health wait timeout in seconds (default: 30)
  CURL_TIMEOUT  Per-request HTTP timeout in seconds (default: 5)
EOF
	exit 0
fi

IMAGE="${1:-${IMAGE:-}}"
PLATFORM="${PLATFORM:-}"
PORT="${PORT:-3000}"
TIMEOUT="${TIMEOUT:-30}"
CURL_TIMEOUT="${CURL_TIMEOUT:-5}"
CONTAINER_NAME="rustume-smoke-${GITHUB_RUN_ID:-local}-$$"

if [[ -z "$IMAGE" ]]; then
	echo "IMAGE is required" >&2
	exit 1
fi

cleanup() {
	docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

trap cleanup EXIT

pull_args=()
run_platform_args=()
if [[ -n "$PLATFORM" ]]; then
	pull_args+=(--platform "$PLATFORM")
	run_platform_args+=(--platform "$PLATFORM")
fi

if [[ "$IMAGE" == *@sha256:* ]]; then
	echo "Pulling ${IMAGE} (${PLATFORM:-default platform})"
	docker pull "${pull_args[@]}" "$IMAGE"
fi

echo "Starting smoke container from ${IMAGE}"
docker run -d --name "$CONTAINER_NAME" \
	"${run_platform_args[@]}" \
	-p "${PORT}:3000" \
	"$IMAGE" >/dev/null

echo "Waiting for /health (timeout ${TIMEOUT}s)"
deadline=$((SECONDS + TIMEOUT))
until curl -sf --max-time "$CURL_TIMEOUT" "http://127.0.0.1:${PORT}/health" >/dev/null; do
	if ((SECONDS >= deadline)); then
		echo "Timed out waiting for /health" >&2
		docker logs "$CONTAINER_NAME" >&2 || true
		exit 1
	fi
	sleep 1
done

echo "Checking web UI"
if ! curl -sf --max-time "$CURL_TIMEOUT" "http://127.0.0.1:${PORT}/" | grep -qi "rustume"; then
	echo "Expected home page to contain 'Rustume'" >&2
	exit 1
fi

echo "Checking Swagger UI"
if ! curl -sf --max-time "$CURL_TIMEOUT" "http://127.0.0.1:${PORT}/swagger-ui/" | grep -qi "swagger"; then
	echo "Expected Swagger UI to load" >&2
	exit 1
fi

echo "Checking OpenAPI document"
if ! curl -sf --max-time "$CURL_TIMEOUT" "http://127.0.0.1:${PORT}/api-docs/openapi.json" | jq -e '.info.version' >/dev/null; then
	echo "Expected valid OpenAPI JSON at /api-docs/openapi.json" >&2
	exit 1
fi

echo "Smoke test passed for ${IMAGE}"
