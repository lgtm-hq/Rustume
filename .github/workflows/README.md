# Workflows overview

This repository uses GitHub Actions for quality gates, coverage, release automation,
and publishing. Most workflows are thin callers to
[lgtm-ci](https://github.com/lgtm-hq/lgtm-ci) reusable workflows pinned at
`66cad82ead0e5d119928c895c7d7da9c837989e5` (**v0.52.3** release commit; not the annotated
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
  rustume-ops repo — this repo ends at the GHCR publish)

## Release

- **semantic-release.yml** — Opens version bump PR via `reusable-release-version-pr`
  (`workflow_run` after Rust Build, Coverage Reports, or Site Quality on `main`;
  `push` fallback for config/scripting/tooling changes that skip all three app-CI
  workflows)
- **auto-tag-on-main.yml** — Creates tags when `Cargo.toml` version changes on `main`
  via `reusable-release-auto-tag` (`version-source: cargo`, `create-release: false`)
- **publish-release-on-tag.yml** — GitHub Release on tag push (inline;
  `create-github-release` composite)
- **build-binary.yml** — Cross-platform release binaries (inline; Windows
  `actions/checkout` exception)

## PR hygiene

- **semantic-pr-title.yml** — Conventional commit title check via
  `reusable-semantic-pr-title`
- **pr-labeler.yml** — Auto-label PRs via `reusable-pr-labeler`
- **pr-auto-assign.yml** — Auto-assign reviewers via `reusable-pr-auto-assign`
- **dependency-review.yml** — PR dependency review via `reusable-dependency-review`

## Security & maintenance

- **security-dependency-review.yml** — Cargo audit via `reusable-security-audit` and
  `reusable-publish-security-audit-comment`
- **codeql.yml** — CodeQL analysis via `reusable-codeql` (per-language build modes)
- **scorecards.yml** — OpenSSF Scorecard via `reusable-scorecards`
- **vuln-suppression-check.yml** — Stale OSV suppression cleanup via
  `reusable-vuln-suppression-check`
- **validate-action-pinning.yml** — SHA pin policy via `reusable-validate-action-pinning`
- **ghcr-cleanup.yml** — GHCR prune (hybrid: `reusable-ghcr-cleanup` for untagged +
  inline tagged retention)
- **renovate.yml** — Scheduled Renovate runs (direct `step-security/harden-runner` +
  lgtm-ci `secure-checkout`; lgtm-ci removed its harden-runner composite in v0.50.0)

## Pin format

Use the **release commit SHA**, not the annotated tag object SHA:

```yaml
uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-docker.yml@66cad82ead0e5d119928c895c7d7da9c837989e5 # v0.52.3
with:
  tooling-ref: '66cad82ead0e5d119928c895c7d7da9c837989e5' # v0.52.3 release commit
```

Sparse `lgtm-hq` tooling checkouts may use `actions/checkout` when `ref:` is quoted and
Renovate-tracked.

Pass `runner-image: ubuntu-24.04` on reusables that expose the input (lgtm-ci #338).
Action-only wrappers (`reusable-codeql`, `reusable-dependency-review`, etc.) and
multi-arch Docker (`runner-map`) follow the exceptions in
[lgtm-ci workflow-contract](https://github.com/lgtm-hq/lgtm-ci/blob/main/docs/workflow-contract.md#runner-pinning-exceptions).

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
