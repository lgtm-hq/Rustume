#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Install the `cross` cross-compilation tool if it is not already present.
# Restored cargo caches can already contain the binary, and a plain
# `cargo install` hard-fails on "binary `cross` already exists" (#885),
# which broke publish-workflow reruns.
set -euo pipefail

if command -v cross >/dev/null 2>&1; then
	echo "cross $(cross --version 2>/dev/null | head -1) already installed — skipping"
	exit 0
fi

cargo install cross --locked
