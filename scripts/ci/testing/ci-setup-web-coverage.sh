#!/usr/bin/env bash
set -euo pipefail

# Prepare Bun for the web coverage workflow.

BUN_VERSION="${BUN_VERSION:-1.3.14}"
npm install --global "bun@${BUN_VERSION}"
bun --version
