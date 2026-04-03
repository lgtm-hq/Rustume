#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# check-vuln-suppressions.sh — Detect stale or expired vulnerability
# suppressions in .osv-scanner.toml and open a cleanup PR removing them.
#
# Usage:
#   scripts/ci/check-vuln-suppressions.sh
#
# Environment:
#   GH_TOKEN - GitHub token for PR creation (required)

set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	cat <<'EOF'
Usage: check-vuln-suppressions.sh

Detect stale or expired vulnerability suppressions in .osv-scanner.toml.

Runs osv-scanner recursively without suppressions to scan all
supported lockfiles (Cargo.lock, etc.) and see which suppressed
vulnerabilities are still present. Opens a PR removing entries
that are stale (vuln resolved) or expired (past expiry date).

Requires GH_TOKEN for PR management.
EOF
	exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Source shared utilities
# shellcheck source=../utils/utils.sh disable=SC1091
source "$SCRIPT_DIR/../utils/utils.sh"

OSV_TOML=".osv-scanner.toml"

if [[ ! -f "$OSV_TOML" ]]; then
	log_success "No $OSV_TOML found. Nothing to check."
	exit 0
fi

log_info "Probing osv-scanner without suppressions..."
PROBE_EXIT=0
PROBE_OUTPUT=$(
	osv-scanner scan --recursive --format json --config /dev/null \
		.
) || PROBE_EXIT=$?

# Exit code 0 = no vulns, 1 = vulns found (both are valid)
# Any other code is a genuine scanner error
if [[ "$PROBE_EXIT" -gt 1 ]]; then
	log_error "osv-scanner failed with exit code $PROBE_EXIT"
	echo "$PROBE_OUTPUT" >&2
	exit "$PROBE_EXIT"
fi

# Classify suppressions using standalone Python script
log_info "Classifying suppressions..."
CLASSIFICATION_JSON=$(echo "$PROBE_OUTPUT" | python3 "$SCRIPT_DIR/classify-suppressions.py")

# Extract IDs from JSON classification (single python3 call)
STALE_IDS=()
EXPIRED_IDS=()
ACTIVE_IDS=()
while IFS= read -r line; do
	category="${line%%:*}"
	vid="${line#*:}"
	case "$category" in
	STALE) STALE_IDS+=("$vid") ;;
	EXPIRED) EXPIRED_IDS+=("$vid") ;;
	ACTIVE) ACTIVE_IDS+=("$vid") ;;
	esac
done < <(echo "$CLASSIFICATION_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for k in ('stale', 'expired', 'active'):
    for i in d.get(k, []):
        print(f'{k.upper()}:{i}')
")

# Only auto-remove stale entries (vuln resolved upstream).
# Expired entries need manual review — the vuln may still be present.
REMOVE_IDS=("${STALE_IDS[@]+"${STALE_IDS[@]}"}")

# Report
for id in "${ACTIVE_IDS[@]+"${ACTIVE_IDS[@]}"}"; do
	log_success "Active: $id"
done
for id in "${STALE_IDS[@]+"${STALE_IDS[@]}"}"; do
	log_warning "Stale: $id"
done
for id in "${EXPIRED_IDS[@]+"${EXPIRED_IDS[@]}"}"; do
	log_warning "Expired: $id"
done

# If nothing to remove (and no expired entries), nothing to do
if [[ ${#REMOVE_IDS[@]} -eq 0 && ${#EXPIRED_IDS[@]} -eq 0 ]]; then
	log_success "All suppressions are active. Nothing to do."
	exit 0
fi

# Check if a PR already exists (fail on gh errors to avoid duplicates)
PR_LIST_OUTPUT=""
PR_LIST_EXIT=0
PR_LIST_OUTPUT=$(
	gh pr list --state open \
		--search "chore(security): remove stale vulnerability" \
		--json number --jq '.[0].number // empty' 2>&1
) || PR_LIST_EXIT=$?
if [[ "$PR_LIST_EXIT" -ne 0 ]]; then
	log_error "gh pr list failed: $PR_LIST_OUTPUT"
	exit 1
fi
if [[ -n "$PR_LIST_OUTPUT" ]]; then
	log_info "Cleanup PR #${PR_LIST_OUTPUT} already open. Skipping."
	exit 0
fi

# --- Remove stale/expired entries from .osv-scanner.toml ---

# Remove stale/expired entries using TOML-aware Python rewrite
# Pass data via env vars to avoid shell injection in inline Python
export REMOVE_IDS_JSON
REMOVE_IDS_JSON=$(printf '%s\n' "${REMOVE_IDS[@]}" | python3 -c "
import json, sys
print(json.dumps([line.strip() for line in sys.stdin if line.strip()]))
")

python3 - "$OSV_TOML" <<'PYEOF'
import json, os, sys, tomllib
from pathlib import Path

toml_path = Path(sys.argv[1])
remove_ids = set(json.loads(os.environ["REMOVE_IDS_JSON"]))

with toml_path.open("rb") as f:
    data = tomllib.load(f)

ignored = data.get("IgnoredVulns", [])
kept = [e for e in ignored if e.get("id") not in remove_ids]

# Rebuild the file preserving comments header
lines = toml_path.read_text().splitlines(keepends=True)
header = []
for line in lines:
    if line.strip().startswith("#") or not line.strip():
        header.append(line)
    else:
        break

# Write header + remaining entries with proper TOML escaping
with toml_path.open("w") as f:
    for line in header:
        f.write(line)
    for entry in kept:
        f.write("[[IgnoredVulns]]\n")
        f.write(f'id = "{entry["id"]}"\n')
        if "ignoreUntil" in entry:
            val = entry["ignoreUntil"]
            iu = val.isoformat() if hasattr(val, "isoformat") else str(val)
            f.write(f"ignoreUntil = {iu}\n")
        if entry.get("reason"):
            escaped = entry["reason"].replace("\\", "\\\\").replace('"', '\\"')
            f.write(f'reason = "{escaped}"\n')
        f.write("\n")

removed = remove_ids - {e.get("id") for e in kept}
for vid in sorted(removed):
    print(f"Removed: {vid}", file=sys.stderr)
PYEOF

# Clean up empty TOML file (only comments/whitespace left)
if [[ -f "$OSV_TOML" ]]; then
	if ! grep -qE '^\[' "$OSV_TOML"; then
		log_info "No entries left in $OSV_TOML, removing file"
		rm -f "$OSV_TOML"
	fi
fi

# Check if any changes were made
if ! git diff --quiet; then
	# Build commit message and PR body
	REMOVED_LIST=""
	for id in "${REMOVE_IDS[@]+"${REMOVE_IDS[@]}"}"; do
		REMOVED_LIST="${REMOVED_LIST}- \`${id}\`
"
	done

	EXPIRED_LIST=""
	for id in "${EXPIRED_IDS[@]+"${EXPIRED_IDS[@]}"}"; do
		EXPIRED_LIST="${EXPIRED_LIST}- \`${id}\`
"
	done

	BRANCH="chore/remove-stale-vulns-$(date +%Y%m%d%H%M%S)"
	configure_git_ci_user
	git checkout -b "$BRANCH"
	git add -A -- "$OSV_TOML"
	git commit -m "$(
		cat <<EOF
chore(security): remove stale vulnerability suppressions

The following suppressions are no longer needed:
${REMOVED_LIST}
Detected by the weekly vuln-suppression-check workflow.
EOF
	)"

	git push -u origin "$BRANCH"

	WF_URL="${GITHUB_SERVER_URL:-https://github.com}"
	WF_URL="${WF_URL}/${GITHUB_REPOSITORY:-lgtm-hq/Rustume}"
	WF_URL="${WF_URL}/actions/workflows/vuln-suppression-check.yml"

	gh pr create \
		--title "chore(security): remove stale vulnerability suppressions" \
		--body "$(
			cat <<EOF
## Summary
- Remove stale vulnerability suppressions (vuln resolved upstream)
${REMOVED_LIST:+
### Removed (stale)
${REMOVED_LIST}}${EXPIRED_LIST:+
### ⚠️ Expired (needs manual review)
The following suppressions have passed their ignoreUntil date but
the vulnerability may still be present. Renew or fix:
${EXPIRED_LIST}}
## Test plan
- [ ] CI security audit passes without these suppressions
- [ ] osv-scanner scan passes without these suppressions

---
*Auto-created by [vuln-suppression-check](${WF_URL}).*
EOF
		)"

	log_success "Cleanup PR created on branch $BRANCH"
else
	log_info "No file changes needed."
fi

# Fail the job if expired entries exist so CI surfaces them
if [[ ${#EXPIRED_IDS[@]} -gt 0 ]]; then
	log_error "Expired suppressions need manual review — renew or fix:"
	for id in "${EXPIRED_IDS[@]}"; do
		log_error "  $id"
	done
	exit 1
fi
