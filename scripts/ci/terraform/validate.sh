#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Purpose: Terraform fmt check and validate for infra/ (no backend, no apply).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"

echo "==> terraform fmt -check -recursive ${INFRA_DIR}"
terraform fmt -check -recursive "${INFRA_DIR}"

validate_dir() {
	local dir="$1"
	echo "==> terraform init -backend=false && terraform validate (${dir})"
	(
		cd "${dir}"
		terraform init -backend=false -input=false >/dev/null
		terraform validate
	)
}

validate_dir "${INFRA_DIR}"

for module_dir in "${INFRA_DIR}"/modules/*/; do
	validate_dir "${module_dir}"
done

echo "Terraform fmt and validate passed."
