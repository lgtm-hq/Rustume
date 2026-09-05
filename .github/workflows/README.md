# Workflows overview

This repository uses GitHub Actions for quality gates, coverage, release automation,
and publishing. Most workflows are thin callers to
[lgtm-ci](https://github.com/lgtm-hq/lgtm-ci) reusable workflows pinned at
`396e1e28f14d371761558178e75be9c56cc994cf` (**v0.63.6** release commit; not the annotated
tag object SHA). All workflow SHA pins include
trailing `# vX.Y.Z` comments so Renovate can track digest updates. Policy is enforced by
[lgtm-ci validate-action-pinning](https://github.com/lgtm-hq/lgtm-ci/pull/221) (via
`validate-action-pinning.yml`) and automated by the
[org Renovate preset](https://github.com/lgtm-hq/.github/pull/12)
(`extends: local>lgtm-hq/.github:renovate-config`).

**Reference implementation:** [py-lintro](https://github.com/lgtm-hq/py-lintro/tree/main/.github/workflows).

## CI (main branch)

- **test-rust.yml** — Rust workspace compile check via `reusable-test-rust-build`
  (ruleset gate: `rust-build / 🔨 Build Check`)
- **coverage.yml** — Single-runtime coverage (lgtm-ci v0.52.3
  compat/coverage contract): `rust-coverage` and `web-coverage` each use
  `coverage: true` and `publish-test-summary: true`; uploads Pages coverage
  HTML artifacts and distinct PR coverage comments (suite name in heading)
- **test-e2e-web.yml** — Web app Playwright suites (smoke, per-flow E2E, visual
  regression including per-template sheet baselines, accessibility) via
  `reusable-test-e2e-playwright` (`test-command:
  scripts/ci/testing/web/e2e.sh` supplies the Rust/wasm-pack stage the reusable
  has no input for); one call runs every suite because they share that build.
  Sheet baselines are CI (Linux) generated — download the report artifact and
  commit `test-results/__screenshots__` (see
  `crates/render/tests/baselines/README.md`). Sibling PDF baselines gate via
  `cargo test -p rustume-render --test template_visual_baselines`.
- **test-e2e-site.yml** — Documentation site Playwright accessibility suites (axe
  scans across surfaces and themes, keyboard/ARIA chrome) via
  `reusable-test-e2e-playwright` (`test-command: scripts/ci/site/e2e.sh` builds
  the production `dist/`, serves it with `astro preview`, and refuses to run
  unless the served build is the one it just built — see
  `scripts/ci/site/assert-served-build.sh`)
- **ci-lintro-analysis.yml** — Lintro quality in Docker via `reusable-quality-lint` and
  `reusable-publish-quality-summary`
- **site-quality.yml** — Docs site build, link check, Astro check, Vitest + pytest via
  `reusable-site-quality`

## Deploy

- **deploy-pages.yml** — Docs site + bundled coverage reports via
  `reusable-deploy-site-with-reports` (triggered after **Coverage Reports** or
  **Quality - Documentation Site** on `main`, or `workflow_dispatch`)
- **docker-build-publish.yml** — Multi-arch GHCR publish via `reusable-docker`
  (`ghcr.io/lgtm-hq/rustume:main`; hosted deploys run from the private
  rustume-ops repo — this repo ends at the GHCR publish). A trailing
  `🔍 Verify Published Tags` job asserts the contracted tags actually resolve
  (`scripts/ci/docker/verify-published-tags.sh`), so a skipped manifest merge
  fails the run instead of passing as "mostly green with skips" (#597).
  Post-merge Vulnerability Scan is a local Trivy job with
  `TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db` (#851); reusable
  Trivy stays PR-only.

## Release

- **semantic-release.yml** — Opens version bump PR via `reusable-release-version-pr`
  (`workflow_run` after Rust Build, Coverage Reports, or Site Quality on `main`;
  `push` fallback for config/scripting/tooling changes that skip all three app-CI
  workflows)
- **auto-tag-on-main.yml** — Creates tags when `Cargo.toml` version changes on `main`
  via `reusable-release-auto-tag` (`version-source: cargo`, `create-release: false`)
- **publish-release-on-tag.yml** — GitHub Release on tag push (inline;
  `create-github-release` composite). `📦 Create GitHub Release` is gated on
  `🔍 Verify Release Image`, which waits for the GHCR tags
  docker-build-publish.yml is contracted to publish, so a Release is never
  created without its image (#597). A failed image verify turns Create
  GitHub Release red instead of skipped (#698). The git tag is created
  earlier by auto-tag-on-main.yml and is **not** covered by that gate
- **reconcile-releases.yml** — Daily (`schedule`) or manual (`workflow_dispatch`)
  check that recent `v*` tags still have a GitHub Release and a GHCR image
  (`scripts/ci/release/reconcile-releases.sh`). Deliberately not triggered on
  tag push: it would race the publish workflows
- **build-binary.yml** — Cross-platform release binaries (inline; Windows
  `actions/checkout` exception)

## PR hygiene

- **semantic-pr-title.yml** — Conventional commit title check via
  `reusable-semantic-pr-title`
- **pr-labeler.yml** — Auto-label PRs via `reusable-pr-labeler`
- **pr-auto-assign.yml** — Auto-assign reviewers via `reusable-pr-auto-assign`
- **dependency-review.yml** — PR dependency review via `reusable-dependency-review`
- **ai-review.yml** — Org AI review via `reusable-ai-review` (`lintro-review[bot]`).
  Pins lgtm-ci **v0.67.0** while the rest of the repo stays on **v0.63.6**;
  `pin-sync-guard.yml` allows that one newer pin.

## Security & maintenance

- **security-dependency-review.yml** — Cargo audit via `reusable-security-audit` and
  `reusable-publish-security-audit-comment`
- **codeql.yml** — CodeQL analysis via `reusable-codeql` (per-language build modes)
- **scorecards.yml** — OpenSSF Scorecard via `reusable-scorecards`
- **vuln-suppression-check.yml** — Stale OSV suppression cleanup via
  `reusable-vuln-suppression-check`
- **validate-action-pinning.yml** — SHA pin policy via `reusable-validate-action-pinning`
- **pin-sync-guard.yml** — Fails when a workflow's `tooling-ref:` input drifts from the
  lgtm-ci `uses:` pin it mirrors, or when non-`ai-review.yml` workflows disagree
  on the lgtm-ci release (`scripts/ci/maintenance/check-tooling-ref-sync.sh`).
  `ai-review.yml` may pin a newer reusable than the shared repo pin.
- **boundary-guard.yml** — Ops boundary path and content guards (inline;
  `scripts/ci/boundary/`)
- **test-boundary-shell.yml** / **test-docker-shell.yml** /
  **test-maintenance-shell.yml** / **test-release-shell.yml** — BATS suites
  for `scripts/ci/` via `reusable-test-shell`
- **ghcr-cleanup.yml** — GHCR prune (hybrid: `reusable-ghcr-cleanup` for untagged +
  inline tagged retention)
- **renovate.yml** — Scheduled Renovate runs (direct `step-security/harden-runner` +
  lgtm-ci `secure-checkout`; lgtm-ci removed its harden-runner composite in v0.50.0)

## Pin format

Use the **release commit SHA**, not the annotated tag object SHA:

```yaml
uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-docker.yml@396e1e28f14d371761558178e75be9c56cc994cf # v0.63.6
with:
  tooling-ref: '396e1e28f14d371761558178e75be9c56cc994cf' # v0.63.6 release commit
```

Sparse `lgtm-hq` tooling checkouts may use `actions/checkout` when `ref:` is quoted and
Renovate-tracked.

Pass `runner-image: ubuntu-24.04` on reusables that expose the input (lgtm-ci #338).
Action-only wrappers (`reusable-codeql`, `reusable-dependency-review`, etc.) and
multi-arch Docker (`runner-map`) follow the exceptions in
[lgtm-ci workflow-contract](https://github.com/lgtm-hq/lgtm-ci/blob/main/docs/workflow-contract.md#runner-pinning-exceptions).

## Version pin inventory

Every version-bearing field in the repo, and what keeps it current. "Manual" rows have no
manager and only move when a human moves them — they are listed so that fact stays visible
instead of being rediscovered after years of drift (#568).

Renovate config lives in `renovate.json`; the shared preset is
`local>lgtm-hq/.github:renovate-config`.

| Path | Field | Pins | Owner |
| --- | --- | --- | --- |
| `.github/workflows/*.yml` | `uses: <owner>/<repo>@<sha> # vX.Y.Z` | Actions and lgtm-ci reusables | Renovate `github-actions` |
| `.github/workflows/*.yml` | `tooling-ref: '<sha>' # vX.Y.Z` (one per lgtm-ci caller job) | lgtm-ci tooling checkout, mirroring the `uses:` pin in the same file | Renovate custom manager (`lgtm-hq/lgtm-ci`, `github-tags`), enforced by `pin-sync-guard.yml` |
| `.github/workflows/ci-lintro-analysis.yml`, `.github/workflows/security-dependency-review.yml` | `lintro-image: ghcr.io/lgtm-hq/py-lintro:<version>@sha256:<digest>` | lintro CI image (version and digest together) | Renovate custom manager (`ghcr.io/lgtm-hq/py-lintro`, `docker`) |
| `.github/workflows/boundary-guard.yml` | `pip install uv==<version>` | uv in the boundary job (`setup-uv` is blocked by the egress policy) | **Manual — no manager** |
| `.github/workflows/coverage.yml`, `deploy-pages.yml`, `site-quality.yml`, `test-e2e-web.yml`, `test-e2e-site.yml` | `node-version:`, `python-version:` | CI runtime majors | **Manual — no manager** |
| `.github/workflows/README.md` | `## Pin format` example | Illustrative lgtm-ci pin | **Manual — no manager**; `pin-sync-guard.yml` does not read Markdown |
| `docker/Dockerfile` | `FROM <image>@sha256:<digest>` | `rust`, `gcr.io/distroless/static` | Renovate `dockerfile` (digest updates automerged) |
| `docker/Dockerfile` | `ARG BUN_VERSION=` | bun release tarball | Renovate custom manager (`oven-sh/bun`, `github-releases`) |
| `scripts/ci/docker/install-cargo-binstall.sh` | `DEFAULT_BINSTALL_VERSION` plus per-arch checksums | cargo-binstall release tarballs used by Docker chef and web-builder | **Manual — version and both SHA-256 values move together** |
| `docker/Dockerfile` | `ARG CARGO_CHEF_VERSION=` | cargo-chef prebuilt via cargo-binstall | Renovate custom manager (`cargo-chef`, `crate`) |
| `scripts/ci/testing/web/install-wasm-pack.sh` | `DEFAULT_WASM_PACK_VERSION` plus per-arch checksums | wasm-pack release tarballs used by CI and Docker | **Manual — canonical version/checksum source** |
| `docker/Dockerfile` | `wasm-bindgen-cli@${WASM_BINDGEN_VERSION}` | Derived from `Cargo.lock` at build time | n/a — no literal pin to update |
| `docker-compose.yml` | `image: postgres:<tag>@sha256:<digest>` | Local dev Postgres | Renovate `docker-compose` |
| `docker-compose.yml` | `image: ghcr.io/lgtm-hq/rustume:latest` | This repo's own image | n/a — deliberately floating |
| `Cargo.toml`, `crates/*/Cargo.toml`, `bindings/*/Cargo.toml` | `[dependencies]` requirements | Rust crates | Renovate `cargo` |
| `Cargo.lock` | Resolved Rust crates | Transitive Rust versions | Renovate `cargo` (updated with the manifest) |
| `apps/web/package.json`, `apps/site/package.json` | `dependencies`, `devDependencies` | JS/TS deps | Renovate `npm` |
| `apps/web/package.json`, `apps/site/package.json` | `overrides` | Forced transitive versions (`astro`, `esbuild`, `sharp`, `ws`, `fast-uri`, …) | Renovate `npm` (extracts `overrides`); `apps/site` TypeScript majors are pinned off in `renovate.json` |
| `apps/web/bun.lock`, `apps/site/bun.lock` | Resolved JS deps | Transitive JS versions | Renovate `npm` (bun lockfile) |
| `pyproject.toml` | `[dependency-groups] lint`, `test` | lintro, pytest | Renovate `pep621` (PEP 735 dependency groups) |
| `uv.lock` | Resolved Python deps | lintro and its tool stack | Renovate `pep621` (refreshed with the manifest) |
| `scripts/ci/site/preview-pages-local.sh` | `CARGO_LLVM_COV_VERSION=` | cargo-llvm-cov | Renovate custom manager (`cargo-llvm-cov`, `crate`) |
| `scripts/ci/boundary/check_content.sh` | `uvx --from semgrep==<version>` | semgrep for the content guard | **Manual — no manager** |
| `scripts/ci/testing/rust/run-server-db-migrations.sh` | `SQLX_CLI_VERSION=` | sqlx-cli | **Manual — no manager** |

The lintro version is authoritative in **two** places that must agree: the `lintro-image:`
pins above (what CI runs) and `pyproject.toml` + `uv.lock` (what `uv run lintro` runs
locally). Move them in the same commit.

## Token patterns

- **`secrets.GITHUB_TOKEN`** — CI, PR comments, artifacts, Pages deploy
- **`secrets.RELEASE_APP_*`** — Release PR and auto-tag (GitHub App installation token
  via lgtm-ci release workflows)
- **`secrets.RENOVATE_*`** — Renovate bot credentials
- **`secrets.CODECOV_TOKEN`** — Not used; coverage is self-hosted on GitHub Pages

## Concurrency

Standard pattern: `<workflow>-${{ github.ref }}` or `build-${{ github.ref }}` with
`cancel-in-progress: true` for PR CI. Deploy and release workflows do not cancel
in-progress runs on `main`.

## Local scripts

Repo-local scripts under `scripts/ci/` remain for site build/test, release binary
packaging, and GHCR tagged prune. Quality,
security audit, release automation, and vulnerability suppression paths are
handled by lgtm-ci reusables.
