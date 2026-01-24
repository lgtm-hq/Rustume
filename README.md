# Rustume

A privacy-first, offline-first resume builder powered by Rust.

## Overview

Rustume is a cross-platform resume builder that prioritizes:

- **Privacy**: Your data stays on your device by default
- **Offline-first**: Works 100% without internet
- **Native performance**: Rust core with native UI shells
- **Modern PDF generation**: Typst-based, no browser dependencies

## Architecture

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

## Crates

| Crate             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `rustume-schema`  | Resume data types and validation                           |
| `rustume-parser`  | Import formats (JSON Resume, LinkedIn, Reactive Resume V3) |
| `rustume-render`  | Typst-based PDF and PNG generation                         |
| `rustume-storage` | Platform storage abstraction                               |
| `rustume-utils`   | Shared utilities (ID generation, string, date, color)      |
| `rustume-cli`     | Command-line interface                                     |
| `rustume-server`  | REST API server with OpenAPI docs                          |
| `rustume-wasm`    | WebAssembly bindings for parser                            |

## Building

```bash
# Build all crates
cargo build

# Run tests
cargo test

# Build CLI
cargo build -p rustume-cli --release

# Build WASM bindings
cd bindings/wasm && wasm-pack build
```

## CLI Usage

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
rustume init my-resume.json
```

## Features

- 4 professionally designed templates (rhyhorn, azurill, pikachu, nosepass)
- Import from JSON Resume, LinkedIn export, and Reactive Resume V3
- Theme customization (colors, fonts, spacing)
- PDF and PNG export
- REST API with OpenAPI/Swagger documentation

## License

MIT
