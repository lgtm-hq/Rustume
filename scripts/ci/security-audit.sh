#!/usr/bin/env bash
# Run osv-scanner via lintro in Docker and generate a security PR comment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../utils/utils.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../utils/utils.sh"

COMMENT_FILE="security-audit-comment.txt"
OSV_RESULTS="osv-results.json"
: "${LINTRO_IMAGE:?LINTRO_IMAGE env var must be set (pin to immutable digest)}"

log_info "Running osv-scanner via lintro in Docker..."

# Remove any stale artifacts from a prior run so an aborted scan cannot be
# mistaken for a successful one downstream.
rm -f "${OSV_RESULTS}" osv-output.txt

OSV_EXIT_CODE=0
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
	-v "$PWD:/code" -w /code "${LINTRO_IMAGE}" \
	lintro check . --tools osv_scanner \
	--output-format json --output /code/"${OSV_RESULTS}" \
	2>&1 | tee osv-output.txt || OSV_EXIT_CODE=$?

PARSE_OK=0
HAS_VULNS=0
if [[ -f "${OSV_RESULTS}" ]]; then
	PYRC=0
	python3 -c "
import json, sys
path = sys.argv[1]
try:
    d = json.load(open(path))
    if not isinstance(d, dict):
        print(f'Unexpected JSON root (not a dict) in {path}', file=sys.stderr)
        sys.exit(2)
    r = next((x for x in d.get('results', []) if isinstance(x, dict) and x.get('tool') == 'osv_scanner'), None)
    if r is None:
        print(f'No osv_scanner result in {path}', file=sys.stderr)
        sys.exit(2)
    sys.exit(0 if r.get('issues_count', 0) > 0 else 1)
except Exception as e:
    print(f'Failed to interpret {path}: {e!r}', file=sys.stderr)
    sys.exit(2)
" "${OSV_RESULTS}" || PYRC=$?
	case "${PYRC}" in
	0)
		PARSE_OK=1
		HAS_VULNS=1
		;;
	1) PARSE_OK=1 ;;
	*) PARSE_OK=0 ;;
	esac
fi

AUDIT_FAILED=0
if [[ "${OSV_EXIT_CODE}" -ne 0 ]] && [[ "${HAS_VULNS}" -eq 0 ]]; then
	log_info "osv-scanner exited non-zero but no valid vulnerability data found"
	AUDIT_FAILED=1
fi
if [[ "${OSV_EXIT_CODE}" -eq 0 ]] && [[ "${PARSE_OK}" -eq 0 ]]; then
	log_error "osv-scanner exited 0 but results are missing or unparseable"
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

if [[ "${HAS_VULNS}" -eq 0 ]] && [[ "${AUDIT_FAILED}" -eq 0 ]] && [[ "${FORMAT_FAILED}" -eq 0 ]]; then
	rm -f "${OSV_RESULTS}" osv-output.txt
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
	echo "has_vulns=${HAS_VULNS}" >>"${GITHUB_OUTPUT}"
	echo "audit_failed=${AUDIT_FAILED}" >>"${GITHUB_OUTPUT}"
fi

if [[ "${AUDIT_FAILED}" -eq 1 ]]; then
	log_error "Security audit failed (tool/scan error)"
	exit 1
elif [[ "${FORMAT_FAILED}" -eq 1 ]]; then
	log_error "Security audit comment formatting failed"
	exit 1
elif [[ "${HAS_VULNS}" -eq 1 ]]; then
	log_error "Security audit found vulnerabilities"
	exit 1
else
	log_success "Security audit passed"
	exit 0
fi
