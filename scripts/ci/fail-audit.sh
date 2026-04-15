#!/usr/bin/env bash
# Fail the CI job when the security audit found vulnerabilities or errors.
set -euo pipefail

echo "::error::Security audit found vulnerabilities or failed. Review the PR comment and CI logs."
exit 1
