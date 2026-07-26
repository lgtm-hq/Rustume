# AGENTS.md

## Cursor Cloud specific instructions

Rustume is a Rust + SolidJS monorepo (privacy-first, offline-first resume builder).
Standard commands live in the `Makefile`, `README.md`, and `CONTRIBUTING.md`; prefer
those. Notes below capture only non-obvious environment caveats for cloud agents.

### Toolchain / dependencies

- Requires **Rust >= 1.85** (a transitive dependency needs the `edition2024`
  Cargo feature). The default stable toolchain in this environment is already
  updated (check with `rustc --version`). If Rust is somehow older, run
  `rustup update stable && rustup default stable`, then
  `rustup target add wasm32-unknown-unknown`.
- Polyglot tooling installed outside the update script (persisted in the VM
  snapshot; PATH is wired via `~/.bashrc`): `bun` (`~/.bun/bin`), `uv`
  (`~/.local/bin`), and `wasm-pack` + `rustup` targets. If any is missing on a
  fresh machine, reinstall per `CONTRIBUTING.md` (bun.sh, astral.sh/uv,
  `cargo install wasm-pack`). The update script only refreshes deps
  (`rustup target add`, `cargo fetch`, `bun install` in `apps/web`).

### Building / running

- The web app depends on a generated WASM package at `apps/web/wasm` (not
  committed; it IS captured in the VM snapshot). It is built by `make setup` /
  `make wasm`, NOT by `make dev`. If `apps/web/wasm` is missing (e.g. after
  `make clean`) or you changed `bindings/wasm` or any core crate, rebuild it with
  `make wasm` before starting the web dev server, or `bun run dev` will fail to
  resolve the wasm import.
- `make dev` runs the API server (`http://localhost:3000`) and the Vite web dev
  server (`http://localhost:5173`) together; the Vite server proxies `/api` and
  `/auth` to `:3000`. Open the web app at :5173. Health check:
  `curl -sf http://localhost:3000/health`.
- Default run is "self-hosted stateless mode" — no database or auth needed.
  Resume editing, import, live preview, and PDF export all work with only
  `make dev`. Cloud mode (`RUSTUME_CLOUD=true`) additionally needs Postgres +
  external WorkOS/Resend credentials (see `.env.example`); those external
  services are not available by default and are not required to test the core
  product.
- PDF/PNG rendering is server-side only (Typst). The API render endpoint is
  `POST /api/render/pdf` and expects a body shaped like
  `{"resume": <resume-json>, "template": "onyx"}` (not a bare resume object).
- The CLI binary is named `rustume` (crate `rustume-cli`), e.g.
  `cargo run -p rustume-cli -- render resume.json -o out.pdf`. It is fully local
  and needs no running services.

### Lint / test

- Rust: `cargo test --workspace`, `cargo clippy --workspace -- -D warnings`.
- Web (`apps/web`): `bun run test` (vitest), `bun run lint` (oxlint),
  `bun run typecheck` (tsc). `make test` / `make lint` run both stacks.
- Cross-language lint/format: `uv run lintro chk` / `uv run lintro fmt`.
- Server DB integration tests need Postgres via `TEST_DATABASE_URL`
  (`scripts/ci/testing/rust/setup-postgres-test-db.sh`); optional otherwise.
