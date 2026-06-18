# Rustume

<!-- markdownlint-disable MD033 MD013 -->
<p align="center">
<img src="docs/rustume.png" alt="Rustume" width="200">
</p>

<p align="center">
A privacy-first, offline-first resume builder powered by Rust.
</p>

<p align="center">
<a href="https://rustume.com/">Documentation site</a>
</p>

<!-- Badges: Build & Quality -->
<p align="center">
<a href="https://github.com/lgtm-hq/Rustume/actions/workflows/coverage.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/lgtm-hq/Rustume/coverage.yml?label=coverage&branch=main&logo=githubactions&logoColor=white" alt="Coverage"></a>
<a href="https://github.com/lgtm-hq/Rustume/actions/workflows/test-rust.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/lgtm-hq/Rustume/test-rust.yml?label=rust%20build&branch=main&logo=githubactions&logoColor=white" alt="Rust build"></a>
<a href="https://github.com/lgtm-hq/Rustume/actions/workflows/ci-lintro-analysis.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/lgtm-hq/Rustume/ci-lintro-analysis.yml?label=lint&branch=main&logo=githubactions&logoColor=white" alt="Lint"></a>
<a href="https://github.com/lgtm-hq/Rustume/actions/workflows/docker-build-publish.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/lgtm-hq/Rustume/docker-build-publish.yml?label=docker&logo=docker&branch=main" alt="Docker"></a>
</p>

<!-- Badges: Security & License -->
<p align="center">
<a href="https://github.com/lgtm-hq/Rustume/actions/workflows/scorecards.yml?query=branch%3Amain"><img src="https://github.com/lgtm-hq/Rustume/actions/workflows/scorecards.yml/badge.svg?branch=main" alt="OpenSSF Scorecard"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License"></a>
</p>

<!-- Badges: Tech Stack -->
<p align="center">
<a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-2021_edition-000000?logo=rust&logoColor=white" alt="Rust"></a>
<a href="https://typst.app/"><img src="https://img.shields.io/badge/Typst-0.14.2-239dad" alt="Typst"></a>
<a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
</p>
<!-- markdownlint-enable MD033 MD013 -->

## 🚀 Quick Start

```bash
# One-command local setup
make setup

# Start the API and web dev server
make dev
```

Open <http://localhost:5173> to use the web app during development.

For self-hosting with Docker, see [Deployment](docs/deployment.md) or the
[documentation site](https://rustume.com/docs/deployment/docker/).

CLI commands are also available:

```bash
# Build all crates
make build

# Run the CLI
cargo run -p rustume-cli -- parse resume.json -o rustume.json
cargo run -p rustume-cli -- render rustume.json -o resume.pdf

# Run tests
make test
```

## ✨ Why Rustume?

- **🔒 Privacy-First** - Your data stays on your device by default
- **📡 Offline-First** - Works 100% without internet
- **⚡ Native Performance** - Rust core with native UI shells
- **📄 Modern PDF** - Typst-based generation, no browser dependencies
- **🎨 12 Templates** - Professionally designed, customizable themes
- **📥 Import Support** - JSON Resume, LinkedIn export, Reactive Resume V3
- **🐳 Docker Ready** - Containerized server with OpenAPI docs

## 💻 CLI Usage

```bash
# Parse a JSON Resume file
rustume parse resume.json -o rustume.json

# Render to PDF
rustume render rustume.json -o resume.pdf

# Generate PNG preview
rustume preview rustume.json -o preview.png

# List available templates
rustume templates

# Create a new resume
rustume init -o my-resume.json
```

## 🐳 Docker

See [Deployment](docs/deployment.md) for pull-from-GHCR, build-from-source,
compose layouts, environment variables, and troubleshooting.

Quick check after the container is running:

```bash
curl -sf http://localhost:3000/health
```

## 🔨 Development

### Prerequisites

- **Rust** (stable) - [Install via rustup](https://rustup.rs/)
- **wasm-pack** - install with `cargo install wasm-pack`
- **bun** - [Install from bun.sh](https://bun.sh/)
- **Python** 3.11+ with uv (for lintro)

### Setup

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume

# Verify prerequisites, install web dependencies, and build WASM
make setup

# Start API + web dev servers
make dev
```

Useful targets:

```bash
make build       # Build WASM, server, and web bundle
make test        # Run Rust and web tests
make preview     # Preview production build locally
```

### Linting

```bash
uv run lintro chk        # Check for issues
uv run lintro fmt        # Auto-fix formatting
```

## 🙏 Acknowledgements

<!-- markdownlint-disable MD033 MD013 -->

Rustume is heavily inspired by and builds upon the work of Reactive Resume by
Amruth Pillai. The template designs in particular are adapted from Reactive
Resume's originals. See [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) for the
required MIT attribution.

<p>
<a href="https://rxresu.me/"><img src="https://img.shields.io/badge/Inspired_by-Reactive_Resume-6c47ff?logo=github&logoColor=white" alt="Reactive Resume"></a>
</p>

<!-- markdownlint-enable MD033 MD013 -->

## 🤝 Community

- 🐛 [Bug Reports](https://github.com/lgtm-hq/Rustume/issues/new)
- 💡 [Feature Requests](https://github.com/lgtm-hq/Rustume/issues/new)
- 📖 [Contributing Guide](CONTRIBUTING.md)

## 📄 License

Rustume is licensed under the [GNU Affero General Public License v3.0
(AGPL-3.0-only)](LICENSE).

**What this means in practice:**

- **Self-hosting** for personal or internal use: fully permitted
- **Offering Rustume as a network service**: you must share your modifications under AGPL
- **CLI and library use locally**: no network interaction, so AGPL network provisions do not apply
- **Template designs**: adapted from
  [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume) (MIT); see
  [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)

Prior commits were released under MIT; AGPL applies from the relicense forward.
See also [NOTICE](NOTICE).

Rustume follows the same licensing approach as projects like Plausible, Cal.com,
Signal, and Standard Notes.
