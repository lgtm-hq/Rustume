#!/usr/bin/env bash
# Generate PNG thumbnails for all resume templates in the docs site.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT_DIR="${ROOT}/apps/site/public/assets/templates"
SAMPLE="$(mktemp)"
trap 'rm -f "${SAMPLE}"' EXIT
TEMPLATES=(
	rhyhorn azurill pikachu nosepass bronzor chikorita
	ditto gengar glalie kakuna leafish onyx
)

mkdir -p "${OUT_DIR}"

cd "${ROOT}"
cargo run -p rustume-cli -- init --sample -o "${SAMPLE}" &>/dev/null

for template in "${TEMPLATES[@]}"; do
	cargo run -p rustume-cli -- preview "${SAMPLE}" -t "${template}" \
		-o "${OUT_DIR}/${template}.png" &>/dev/null
	echo "Generated ${template}.png"
done
