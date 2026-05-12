# Rustume

Privacy-first, offline-first resume builder powered by Rust and Typst.

## Commands

- `cargo build` — Build the Rust backend
- `cargo test` — Run Rust tests
- `bun install && bun run build` — Build the frontend
- `bun run test` — Run frontend tests

## Stack

- Rust backend, TypeScript frontend
- Typst for document rendering
- Docker for containerized builds

## Standards

- Use `lintro` for linting (`lintro chk`, `lintro fmt`)
- Use `bun` instead of `npm`