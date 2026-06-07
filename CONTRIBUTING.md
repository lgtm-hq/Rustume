# Contributing to Rustume

Thank you for your interest in contributing to Rustume! This document provides
guidelines and information for contributors.

## Development Setup

### Prerequisites

- **Rust toolchain**: Install via [rustup](https://rustup.rs/)

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **wasm-pack**: Required to build browser WASM bindings

  ```bash
  cargo install wasm-pack
  ```

- **bun**: Required for the SolidJS web app

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Python 3.11+**: Required for `lintro` linting tool
- **uv**: Python package manager for `lintro`

  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### Building

```bash
# Clone the repository
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume

# Verify prerequisites, install web dependencies, and build WASM
make setup

# Start the API and web app
make dev
```

The API listens on <http://localhost:3000>. The Vite dev server listens on
<http://localhost:5173> and proxies API calls to the server.

### Running Tests

```bash
# Run all workspace tests
make test

# Run tests for a specific crate
cargo test -p rustume-schema
cargo test -p rustume-parser
cargo test -p rustume-render
cargo test -p rustume-server
cargo test -p rustume-cli
cargo test -p rustume-storage
```

## Linting and Formatting

We use `lintro` for all linting and formatting.

```bash
# Check for lint issues
uv run lintro chk

# Auto-fix formatting issues
uv run lintro fmt
```

Use the Makefile for common build flows:

```bash
make build       # Build WASM, server, and web bundle
make preview     # Preview production assets locally
make site-dev    # Astro docs site dev server
make site-build  # Production docs site build (GitHub Pages base path)
make site-test   # Vitest for docs site TypeScript
docker compose up          # Pull and run the published GHCR image
docker compose up --build  # Build locally and run (no GHCR access required)
```

## Docker

The root `docker-compose.yml` is the single entry point for container workflows:

- `docker compose up` — pulls `ghcr.io/lgtm-hq/rustume:latest` and starts the server
- `docker compose up --build` — builds from `docker/Dockerfile` when GHCR is
  unavailable or you need local changes

After startup, verify the server with `curl http://localhost:3000/health`.

## Architecture Overview

Full architecture documentation lives on the published docs site:

- Local preview: `make site-dev` then open <http://localhost:4321/Rustume/>
- Published: <https://lgtm-hq.github.io/Rustume/docs/architecture/overview/>

Rustume follows a modular crate architecture:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Rust Core (rustume-*)                     │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│  │  WASM  │  │  CLI   │  │ Server │  │  Web   │             │
│  └────────┘  └────────┘  └────────┘  └────────┘             │
│                                                              │
│  Crates: schema | parser | render | storage | utils          │
└─────────────────────────────────────────────────────────────┘
```

### Crate Responsibilities

| Crate             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `rustume-schema`  | Resume data types, validation, and JSON schema definitions |
| `rustume-parser`  | Import parsers for JSON Resume, LinkedIn, Reactive Resume  |
| `rustume-render`  | Typst-based PDF/PNG generation with templates              |
| `rustume-storage` | Platform-agnostic storage abstraction                      |
| `rustume-utils`   | Shared utilities (ID generation, string, date, color)      |
| `rustume-cli`     | Command-line interface binary                              |
| `rustume-server`  | REST API with OpenAPI documentation                        |
| `rustume-wasm`    | WebAssembly bindings for browser usage                     |
| `apps/web`        | SolidJS resume builder served by Vite or the Rust server   |

### Dependency Flow

```text
utils ← schema ← parser
                ← render
                ← storage
                ← cli
                ← server
                ← wasm
```

Core crates (`utils`, `schema`) have no dependencies on higher-level crates.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages:

```text
<type>(optional-scope): concise summary

[optional body]

[optional footer(s)]
```

### Types

| Type       | Description                     | Version Bump |
| ---------- | ------------------------------- | ------------ |
| `feat`     | New feature                     | MINOR        |
| `fix`      | Bug fix                         | PATCH        |
| `perf`     | Performance improvement         | PATCH        |
| `docs`     | Documentation only              | None         |
| `refactor` | Code change with no feature/fix | None         |
| `test`     | Adding/updating tests           | None         |
| `chore`    | Build, CI, tooling changes      | None         |
| `ci`       | CI configuration                | None         |
| `style`    | Formatting, whitespace          | None         |

### Breaking Changes

Indicate breaking changes with `!` after the type:

```text
feat(schema)!: rename Basics fields for clarity
```

Or include `BREAKING CHANGE:` in the footer.

### Examples

```text
feat(cli): add --debug flag for verbose logging
fix(parser): handle empty work array in JSON Resume
refactor(render): extract template loading to separate module
test(storage): add concurrent access tests
docs: update README with deployment instructions
```

## Pull Request Process

1. **Fork and branch**: Create a feature branch from `main`

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make changes**: Follow the coding standards and add tests

3. **Run checks locally**:

   ```bash
   make test
   uv run lintro chk
   ```

4. **Commit**: Use conventional commits

5. **Push and create PR**: Use the PR template

6. **Review**: Address feedback and ensure CI passes

### PR Title

The PR title becomes the merge commit message (squash merge). Follow the same conventional commit format.

### PR Checklist

- [ ] Title follows Conventional Commits
- [ ] Tests added/updated for changes
- [ ] Documentation updated if user-facing
- [ ] Local CI passed

## Code Style

### Rust

- Follow standard Rust idioms and naming conventions
- Use `?` for error propagation
- Prefer `impl Into<String>` for builder methods
- Document public APIs with `///` comments
- Keep functions focused and reasonably sized

### Tests

- Place unit tests in the same file as the code (`#[cfg(test)] mod tests`)
- Place integration tests in `tests/` directory
- Use descriptive test names: `test_parse_json_resume_with_empty_basics`
- Test both success and error paths

## Troubleshooting

### `make build` fails downloading Swagger UI

The server crate uses `utoipa-swagger-ui` with the `reqwest` feature so Swagger
UI is downloaded at compile time using system TLS (not `curl` with a hardcoded
CA path). If the error persists, ensure network access to GitHub releases and
run `cargo clean -p utoipa-swagger-ui` before rebuilding.

Behind TLS-intercepting proxies, the download may still fail with
`InvalidCertificate(UnknownIssuer)`. Point the build at a local copy of the
Swagger UI zip instead (see the
[swagger-ui releases](https://github.com/swagger-api/swagger-ui/tags) for the
version pinned in `utoipa-swagger-ui`):

```bash
export SWAGGER_UI_DOWNLOAD_URL="file:///path/to/swagger-ui-5.17.14.zip"
cargo build -p rustume-server
```

### `docker build` fails installing bun (SSL or Rosetta)

The Dockerfile runs `update-ca-certificates` before any `curl` to GitHub. If
you are behind a corporate proxy, add your organization's CA to Docker Desktop
(**Settings → Docker Engine** or trusted certs) and retry.

On Apple Silicon, `rosetta error: failed to open elf at /lib/ld-musl-x86_64.so.1`
means an amd64 musl `bun` binary ran under Rosetta. Build for your native
platform instead:

```bash
docker build --platform linux/arm64 -t rustume -f docker/Dockerfile .
```

CI publishes `linux/amd64` and `linux/arm64` images via buildx; both arches
install the matching `bun-linux-*-musl` zip in the web-builder stage.

### `docker pull ghcr.io/lgtm-hq/rustume:latest` not found

Release images are published on `v*.*.*` tag push, not on every `main` merge.
Check Actions → “Build - Docker Image & Registry” for the release tag workflow.
Until then, build locally with `docker build -t rustume -f docker/Dockerfile .`
or pull `:main` for the latest main-branch image. See
[docs/deployment.md](docs/deployment.md).

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- For questions, open a discussion or issue

## License

By contributing, you agree that your contributions will be licensed under the
GNU Affero General Public License v3.0 only (AGPL-3.0-only). See [LICENSE](LICENSE)
for details.
