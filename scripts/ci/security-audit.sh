#!/usr/bin/env bash
# Run osv-scanner via lintro in Docker and generate a security PR comment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../utils/utils.sh
source "${SCRIPT_DIR}/../utils/utils.sh"

COMMENT_FILE="security-audit-comment.txt"
OSV_RESULTS="osv-results.json"
LINTRO_IMAGE="${LINTRO_IMAGE:-py-lintro:latest}"

log_info "Running osv-scanner via lintro in Docker..."

OSV_EXIT_CODE=0
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/code" -w /code "${LINTRO_IMAGE}" \
  lintro check . --tools osv_scanner \
  --output-format json --output /code/"${OSV_RESULTS}" \
  2>&1 | tee osv-output.txt || OSV_EXIT_CODE=$?

HAS_VULNS=0
if [[ -f "${OSV_RESULTS}" ]] && python3 -c "
import json, sys
path = sys.argv[1]
try:
    d = json.load(open(path))
    r = next((x for x in d.get('results', []) if x.get('tool') == 'osv_scanner'), None)
    sys.exit(0 if r and r.get('issues_count', 0) > 0 else 1)
except (json.JSONDecodeError, KeyError) as e:
    print(f'Failed to parse {path}: {e}', file=sys.stderr)
    sys.exit(1)
" "${OSV_RESULTS}" 2>&1; then
  HAS_VULNS=1
fi

AUDIT_FAILED=0
if [[ "${OSV_EXIT_CODE}" -ne 0 ]] && [[ "${HAS_VULNS}" -eq 0 ]]; then
  log_info "osv-scanner exited non-zero but no valid vulnerability data found"
  AUDIT_FAILED=1
fi

format_err=$(mktemp)
FORMAT_FAILED=0
if ! COMMENT_BODY=$(python3 "${SCRIPT_DIR}/format-security-comment.py" "${OSV_RESULTS}" 2>"${format_err}"); then
  log_error "format-security-comment.py failed:"
  cat "${format_err}" >&2
  COMMENT_BODY="Failed to format security audit results. See CI logs for details."
  FORMAT_FAILED=1
fi
rm -f "${format_err}"

if [[ "${AUDIT_FAILED}" -eq 1 ]]; then
  STATUS="⚠️ AUDIT FAILED"
elif [[ "${FORMAT_FAILED}" -eq 1 ]]; then
  STATUS="⚠️ FORMAT FAILED"
elif [[ "${HAS_VULNS}" -eq 1 ]]; then
  STATUS="⚠️ VULNERABILITIES FOUND"
else
  STATUS="✅ PASSED"
fi

CONTENT="<!-- security-audit-report -->

${COMMENT_BODY}"

generate_pr_comment "Security Audit" "${STATUS}" "${CONTENT}" "${COMMENT_FILE}"

if [[ "${HAS_VULNS}" -eq 0 ]] && [[ "${AUDIT_FAILED}" -eq 0 ]]; then
  rm -f "${OSV_RESULTS}" osv-output.txt
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "has_vulns=${HAS_VULNS}" >>"${GITHUB_OUTPUT}"
  echo "audit_failed=${AUDIT_FAILED}" >>"${GITHUB_OUTPUT}"
fi

if [[ "${AUDIT_FAILED}" -eq 1 ]]; then
  log_error "Security audit failed (tool/scan error)"
  exit 1
elif [[ "${HAS_VULNS}" -eq 1 ]]; then
  log_error "Security audit found vulnerabilities"
  exit 1
else
  log_success "Security audit passed"
  exit 0
fi
