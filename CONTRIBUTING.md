# Contributing to Rustume

Thank you for your interest in contributing to Rustume! This document provides
guidelines and information for contributors.

## Development Setup

### Prerequisites

- **Rust toolchain**: Install via [rustup](https://rustup.rs/)

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Python 3.11+**: Required for linting tools
- **uv**: Python package manager

  ```bash
  pip install uv
  ```

### Building

```bash
# Clone the repository
git clone https://github.com/TurboCoder13/Rustume.git
cd Rustume

# Build all crates
cargo build

# Build in release mode
cargo build --release
```

### Running Tests

```bash
# Run all workspace tests
cargo test --workspace

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

Additionally, run Clippy for Rust-specific lints:

```bash
cargo clippy --workspace
```

## Architecture Overview

Rustume follows a modular crate architecture:

```text
┌─────────────────────────────────────────────────────────────┐
│                    Rust Core (rustume-*)                     │
│  ┌────────┐  ┌────────┐  ┌────────┐                         │
│  │  WASM  │  │  CLI   │  │ Server │                         │
│  └────────┘  └────────┘  └────────┘                         │
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
   cargo test --workspace
   cargo clippy --workspace
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

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- For questions, open a discussion or issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
