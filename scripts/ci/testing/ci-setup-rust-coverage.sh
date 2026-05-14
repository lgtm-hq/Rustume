#!/usr/bin/env bash
set -euo pipefail

# Prepare the Rust toolchain used by the coverage workflow.

rustup toolchain install stable --profile minimal
rustup default stable
