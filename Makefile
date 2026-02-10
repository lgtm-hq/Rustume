.PHONY: all build dev dev-watch clean clean-all install wasm server server-build web web-build test lint fmt help check-deps preview setup

# Ensure rustup's toolchain is used (prioritize over Homebrew)
export PATH := $(HOME)/.cargo/bin:$(PATH)

# Default target
all: build

# Check prerequisites
check-deps:
	@echo "Checking dependencies..."
	@command -v cargo >/dev/null 2>&1 || { echo "Error: cargo not found. Install Rust from https://rustup.rs"; exit 1; }
	@command -v bun >/dev/null 2>&1 || { echo "Error: bun not found. Install from https://bun.sh"; exit 1; }
	@command -v wasm-pack >/dev/null 2>&1 || { echo "Error: wasm-pack not found. Install with: cargo install wasm-pack"; exit 1; }
	@rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown || \
		(rustc --print sysroot | xargs -I{} test -d "{}/lib/rustlib/wasm32-unknown-unknown" 2>/dev/null) || \
		{ echo "Error: wasm32-unknown-unknown target not installed."; \
		  echo "  Run: rustup target add wasm32-unknown-unknown"; \
		  echo "  (If you don't have rustup, install from: https://rustup.rs)"; \
		  exit 1; }
	@echo "All dependencies OK!"

# Install all dependencies
install:
	@echo "Installing Rust dependencies..."
	cargo fetch
	@echo "Installing web dependencies..."
	cd apps/web && bun install

# Build WASM module (release mode for production)
wasm:
	@echo "Building WASM..."
	cd bindings/wasm && wasm-pack build --release --target web --out-dir ../../apps/web/wasm

# Build the Rust server
server-build:
	@echo "Building server..."
	cargo build --release --bin rustume-server

# Build the web app
web-build: wasm
	@echo "Building web app..."
	cd apps/web && bun run build

# Build everything
build: wasm server-build web-build
	@echo "Build complete!"

# Run the server (foreground)
server:
	cargo run --bin rustume-server

# Run web dev server (foreground)
web:
	cd apps/web && bun run dev

# Development mode - runs both server and web dev server
dev:
	@echo "Starting development servers..."
	@echo "Server: http://localhost:3000"
	@echo "Web:    http://localhost:5173"
	@echo ""
	@echo "Press Ctrl+C to stop both servers"
	@echo ""
	@set -e; \
		trap 'kill 0 2>/dev/null; exit' EXIT INT TERM; \
		cargo run --bin rustume-server & \
		sleep 2 && cd apps/web && bun run dev

# Development with auto-reload (requires cargo-watch)
dev-watch:
	@echo "Starting development servers with auto-reload..."
	@command -v cargo-watch >/dev/null 2>&1 || { echo "Error: cargo-watch not found. Install with: cargo install cargo-watch"; exit 1; }
	@set -e; \
		trap 'kill 0 2>/dev/null; exit' EXIT INT TERM; \
		cargo watch -x 'run --bin rustume-server' & \
		sleep 2 && cd apps/web && bun run dev

# Run all tests
test:
	@echo "Running Rust tests..."
	cargo test --workspace
	@echo "Running web tests..."
	@if grep -q '"test"' apps/web/package.json 2>/dev/null; then \
		cd apps/web && bun test; \
	else \
		echo "Skipping web tests (no test script configured)"; \
	fi

# Lint everything
lint:
	@echo "Linting Rust..."
	cargo clippy --workspace -- -D warnings
	@echo "Linting web..."
	@if grep -q '"lint"' apps/web/package.json 2>/dev/null; then \
		cd apps/web && bun run lint; \
	else \
		echo "Skipping web lint (no lint script configured)"; \
	fi

# Format everything
fmt:
	@echo "Formatting Rust..."
	cargo fmt --all
	@echo "Formatting web..."
	@if grep -q '"fmt"' apps/web/package.json 2>/dev/null; then \
		cd apps/web && bun run fmt; \
	else \
		echo "Skipping web fmt (no fmt script configured)"; \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning Rust artifacts..."
	cargo clean
	@echo "Cleaning web artifacts..."
	rm -rf apps/web/dist apps/web/wasm apps/web/node_modules/.vite

# Deep clean - also clears cargo cache (frees significant disk space)
clean-all: clean
	@echo "WARNING: This will clear your global cargo cache (~/.cargo/registry/cache and ~/.cargo/git/checkouts)"
	@echo "This affects ALL Rust projects on your system, not just this one."
	@printf "Are you sure? [y/N] " && read confirm && [ "$$confirm" = "y" ] || { echo "Aborted."; exit 1; }
	@echo "Cleaning cargo registry cache..."
	rm -rf ~/.cargo/registry/cache/*
	@echo "Cleaning cargo git cache..."
	rm -rf ~/.cargo/git/checkouts/*
	@echo ""
	@echo "Deep clean complete. Run 'cargo fetch' or 'make install' to restore dependencies."

# Preview production build
preview: build
	@echo "Starting production preview..."
	@echo "Server: http://localhost:3000"
	@echo "Web:    http://localhost:4173"
	@set -e; \
		trap 'kill 0 2>/dev/null; exit' EXIT INT TERM; \
		cargo run --release --bin rustume-server & \
		sleep 2 && cd apps/web && bun run preview

# Quick start for new developers
setup: check-deps install wasm
	@echo ""
	@echo "============================================"
	@echo "Setup complete!"
	@echo ""
	@echo "Run 'make dev' to start development servers"
	@echo "============================================"

# Help
help:
	@echo "Rustume Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Quick Start:"
	@echo "  make setup       Full setup (check deps, install, build WASM)"
	@echo "  make dev         Start both servers for development"
	@echo ""
	@echo "Build Targets:"
	@echo "  build            Build everything (WASM + server + web)"
	@echo "  wasm             Build WASM module only"
	@echo "  server-build     Build server only"
	@echo "  web-build        Build web app only"
	@echo ""
	@echo "Run Targets:"
	@echo "  dev              Start server + web dev server"
	@echo "  dev-watch        Dev with auto-reload (needs cargo-watch)"
	@echo "  server           Run only the Rust server"
	@echo "  web              Run only the web dev server"
	@echo "  preview          Preview production build"
	@echo ""
	@echo "Other:"
	@echo "  install          Install dependencies"
	@echo "  check-deps       Verify prerequisites"
	@echo "  test             Run all tests"
	@echo "  lint             Lint all code"
	@echo "  fmt              Format all code"
	@echo "  clean            Clean build artifacts"
	@echo "  clean-all        Deep clean (also clears cargo cache)"
	@echo ""
	@echo "Prerequisites:"
	@echo "  - Rust with wasm32-unknown-unknown target"
	@echo "  - wasm-pack (cargo install wasm-pack)"
	@echo "  - bun (https://bun.sh)"
