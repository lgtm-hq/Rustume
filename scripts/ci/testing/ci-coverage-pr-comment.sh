#!/usr/bin/env bash
set -euo pipefail

# Generate a language-specific coverage PR comment from CI metrics.

# shellcheck source=../../utils/utils.sh disable=SC1091
source "$(dirname "$0")/../../utils/utils.sh"

if ! is_pr_context; then
	log_info "Not in a PR context, skipping coverage comment generation"
	exit 0
fi

: "${COVERAGE_NAME:?COVERAGE_NAME is required}"
: "${COVERAGE_MARKER:?COVERAGE_MARKER is required}"
: "${COVERAGE_COMMAND:?COVERAGE_COMMAND is required}"
: "${COVERAGE_OUTPUT_FILE:?COVERAGE_OUTPUT_FILE is required}"

COVERAGE_TOOL="${COVERAGE_TOOL:-coverage}"
COVERAGE_EXIT_CODE="${COVERAGE_EXIT_CODE:-}"
COVERAGE_LOG_FILE="${COVERAGE_LOG_FILE:-}"

if [[ -z "$COVERAGE_EXIT_CODE" ]]; then
	case "$COVERAGE_NAME" in
	Rust) COVERAGE_EXIT_CODE="${RUST_COVERAGE_EXIT_CODE:-1}" ;;
	Web) COVERAGE_EXIT_CODE="${WEB_COVERAGE_EXIT_CODE:-1}" ;;
	*) COVERAGE_EXIT_CODE="1" ;;
	esac
fi

coverage_rows=""
add_metric_row() {
	local label="$1"
	local value="$2"

	if [[ -n "$value" ]]; then
		coverage_rows="${coverage_rows}| ${label} | ${value}% |
"
	fi
}

add_metric_row "Lines" "${COVERAGE_LINES:-}"
add_metric_row "Branches" "${COVERAGE_BRANCHES:-}"
add_metric_row "Functions" "${COVERAGE_FUNCTIONS:-}"
add_metric_row "Statements" "${COVERAGE_STATEMENTS:-}"

if [[ -z "$coverage_rows" ]]; then
	coverage_rows="| Coverage | Not available |
"
fi

if [[ "$COVERAGE_EXIT_CODE" != "0" ]]; then
	STATUS="⚠️ COVERAGE FAILED"
	if [[ -n "$COVERAGE_LOG_FILE" && -f "$COVERAGE_LOG_FILE" ]]; then
		OUTPUT=$(tail -100 "$COVERAGE_LOG_FILE")
	else
		OUTPUT="Coverage failed before a report was generated. Check CI logs for details."
	fi

	CONTENT="${COVERAGE_MARKER}

**Workflow:**
1. Ran \`${COVERAGE_COMMAND}\`

### Results:
\`\`\`
${OUTPUT}
\`\`\`"
else
	STATUS="✅ COVERAGE GENERATED"
	CONTENT="${COVERAGE_MARKER}

**Workflow:**
1. Ran \`${COVERAGE_COMMAND}\`
2. Collected coverage metrics from the generated report

### Results:
| Metric | Coverage |
|--------|----------|
${coverage_rows}"
fi

generate_pr_comment \
	"📊 ${COVERAGE_NAME} Coverage Report" \
	"$STATUS" \
	"$CONTENT" \
	"$COVERAGE_OUTPUT_FILE" \
	"$COVERAGE_TOOL"
