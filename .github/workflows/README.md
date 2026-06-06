# Workflows overview

This repository uses GitHub Actions for quality gates, coverage, release automation,
and publishing. Most workflows are thin callers to
[lgtm-ci](https://github.com/lgtm-hq/lgtm-ci) reusable workflows pinned at
`0c9b946ff6bb93e3e67ce1d1f4a3c419266dc79e` (**v0.33.0**). All workflow SHA pins include
trailing `# vX.Y.Z` comments so Renovate can track digest updates. Policy is enforced by
[lgtm-ci validate-action-pinning](https://github.com/lgtm-hq/lgtm-ci/pull/221) (via
`validate-action-pinning.yml`) and automated by the
[org Renovate preset](https://github.com/lgtm-hq/.github/pull/12)
(`extends: local>lgtm-hq/.github:renovate-config`).

**Reference implementation:** [py-lintro](https://github.com/lgtm-hq/py-lintro/tree/main/.github/workflows).

## CI (main branch)

- **test-rust.yml** — Rust workspace compile check via `reusable-test-rust-build`
  (ruleset gate: `rust-build / 🔨 Build Check`)
- **coverage.yml** — Rust + web coverage via `reusable-rust-test` and
  `reusable-test-node`; uploads Pages coverage HTML artifacts and PR test summaries
- **ci-lintro-analysis.yml** — Lintro quality in Docker (inline exception: custom image
  pin + fork-safe PR comment scripts)
- **site-quality.yml** — Docs site build, link check, Astro check, Vitest (inline by
  design: custom Vitest JSON layout)

## Deploy

- **deploy-pages.yml** — Docs site + bundled coverage reports via
  `reusable-deploy-site-with-reports` (triggered after **Coverage Reports** or
  **Quality - Documentation Site** on `main`, or `workflow_dispatch`)
- **docker-build-publish.yml** — Multi-arch GHCR publish via `reusable-docker`

## Release

- **semantic-release.yml** — Opens version bump PR (inline exception: dual
  `workflow_run` + `push` triggers; `calculate-version` composite + local release
  scripts)
- **auto-tag-on-main.yml** — Creates tags when `Cargo.toml` version changes on `main`
  (inline; lgtm-ci composites)
- **publish-release-on-tag.yml** — GitHub Release on tag push (inline;
  `create-github-release` composite)
- **build-binary.yml** — Cross-platform release binaries (inline; Windows
  `actions/checkout` exception)

## PR hygiene

- **semantic-pr-title.yml** — Conventional commit title check via
  `reusable-semantic-pr-title`
- **pr-labeler.yml** — Auto-label PRs via `reusable-pr-labeler`
- **pr-auto-assign.yml** — Auto-assign reviewers via `reusable-pr-auto-assign`
- **dependency-review.yml** — PR dependency review (inline exception; hardened audit
  path in `security-dependency-review.yml`)

## Security & maintenance

- **security-dependency-review.yml** — Cargo audit + PR comment (lgtm-ci composites +
  upstream `post-pr-comment` action)
- **codeql.yml** — CodeQL analysis (inline exception: multi-language `build-mode`
  conflict with `reusable-codeql`)
- **scorecards.yml** — OpenSSF Scorecard via `reusable-scorecards`
- **vuln-suppression-check.yml** — Validates `vuln-suppressions.toml` (lgtm-ci
  composites + local script)
- **validate-action-pinning.yml** — SHA pin policy via `reusable-validate-action-pinning`
- **ghcr-cleanup.yml** — GHCR prune (hybrid: `reusable-ghcr-cleanup` for untagged +
  inline tagged retention)
- **renovate.yml** — Scheduled Renovate runs (lgtm-ci composites)

## Pin format

Use the **release commit SHA**, not the annotated tag object SHA:

```yaml
uses: lgtm-hq/lgtm-ci/.github/workflows/reusable-docker.yml@0c9b946ff6bb93e3e67ce1d1f4a3c419266dc79e # v0.33.0
with:
  tooling-ref: '0c9b946ff6bb93e3e67ce1d1f4a3c419266dc79e' # v0.33.0
```

Sparse `lgtm-hq` tooling checkouts may use `actions/checkout` when `ref:` is quoted and
Renovate-tracked.

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

Repo-local scripts under `scripts/ci/` remain only for documented inline workflow
exceptions (lintro Docker, semantic release, site quality, GHCR tagged prune, etc.).
Coverage and PR-hygiene paths are handled by lgtm-ci reusables.
