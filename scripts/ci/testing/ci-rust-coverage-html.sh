#!/usr/bin/env bash
set -euo pipefail

# Generate an HTML coverage report from the prior cargo llvm-cov run in the same job.

OUTPUT_DIR="${RUST_COVERAGE_HTML_DIR:-rust-coverage-html}"
TEMP_DIR="${OUTPUT_DIR}.tmp"

if ! command -v cargo-llvm-cov >/dev/null 2>&1; then
	echo "cargo-llvm-cov is required; run ci-setup-rust-coverage.sh and ci-rust-coverage.sh first." >&2
	exit 1
fi

rm -rf "${OUTPUT_DIR}" "${TEMP_DIR}"
cargo llvm-cov report --html --output-dir "${TEMP_DIR}"

if [[ ! -d "${TEMP_DIR}/html" ]]; then
	echo "Expected ${TEMP_DIR}/html after cargo llvm-cov report --html" >&2
	exit 1
fi

mv "${TEMP_DIR}/html" "${OUTPUT_DIR}"
rm -rf "${TEMP_DIR}"

echo "Rust coverage HTML written to ${OUTPUT_DIR}/"
