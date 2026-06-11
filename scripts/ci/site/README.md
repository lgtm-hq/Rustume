# Site CI scripts

| Script | Purpose |
| --- | --- |
| `build.sh` | Build Astro site (`ASTRO_BASE` defaults from `defaults.env`) |
| `check.sh` | `astro check` and dependency install |
| `test.sh` | Vitest with coverage |
| `test-python.sh` | Pytest for `tests/scripts/ci/` |
| `test-all.sh` | `test.sh` + `test-python.sh` |
| `preview-serve.sh` | `astro preview` with `ASTRO_BASE` from `defaults.env` (required for `/Rustume/`) |
| `preview-pages-local.sh` | Build dist + optional local coverage bundles for manual Pages preview |

## Astro base path

[`defaults.env`](defaults.env) defines `ASTRO_BASE_DEFAULT` (currently `/Rustume/`).
[`build.sh`](build.sh) and the root [`Makefile`](../../../Makefile) `SITE_ASTRO_BASE` target read
that value — do not duplicate the path elsewhere.

| Context | `ASTRO_BASE` |
| --- | --- |
| Local `make site-dev` / `site-build` | `ASTRO_BASE_DEFAULT` from `defaults.env` |
| `site-quality.yml` link check build | `/` (root-relative hrefs under `dist/`; lychee via `reusable-site-quality`) |
| `deploy-pages.yml` production deploy | `ASTRO_BASE_DEFAULT` via `build.sh` |

## GitHub Pages (Model B: site + bundled reports)

Deploy uses **lgtm-ci**
[`reusable-deploy-site-with-reports`](https://github.com/lgtm-hq/lgtm-ci/blob/main/.github/workflows/reusable-deploy-site-with-reports.yml)
via [`.github/workflows/deploy-pages.yml`](../../../.github/workflows/deploy-pages.yml).

1. **Coverage Reports** uploads HTML on `main` (`rust-coverage-html`, `web-coverage-html`).
2. **Deploy - GitHub Pages** runs on `workflow_run` after **Coverage Reports** or
   **Quality - Documentation Site** succeeds on `main`, or via `workflow_dispatch`.
3. The reusable workflow builds `apps/site/dist`, merges artifacts per
   [`.github/pages-bundle-manifest.json`](../../../.github/pages-bundle-manifest.json),
   and publishes to GitHub Pages.

| Published path | Content |
| --- | --- |
| `https://lgtm-hq.github.io/Rustume/` | Astro documentation site |
| `https://lgtm-hq.github.io/Rustume/coverage-rust/` | Rust `cargo llvm-cov` HTML report |
| `https://lgtm-hq.github.io/Rustume/coverage-web/` | Web Vitest HTML report |

**Settings → Pages → Build and deployment → Source: GitHub Actions** (not “Deploy from a branch”).

**About URL** (manual): repository **About** → **Website** → `https://lgtm-hq.github.io/Rustume/`.

## Local preview (manual check before merge)

```bash
# Full preview: site + web + rust coverage (rust step is slow)
./scripts/ci/site/preview-pages-local.sh

# Docs only, then preview server
PREVIEW_INCLUDE_RUST=0 PREVIEW_INCLUDE_WEB=0 ./scripts/ci/site/preview-pages-local.sh

# Build dist only (no server)
PREVIEW_SERVE=0 ./scripts/ci/site/preview-pages-local.sh
```

Open [http://127.0.0.1:4321/Rustume/](http://127.0.0.1:4321/Rustume/) — not `/`, which
serves unstyled HTML when the build used `/Rustume/`. Use `make site-preview`,
`bun run preview` in `apps/site`, or `preview-pages-local.sh`; all load `ASTRO_BASE`
via `preview-serve.sh`.

Coverage trees appear under `/Rustume/coverage-rust/` and `/Rustume/coverage-web/` when generated.

## CI scripts (site quality)

| Script | Purpose |
| --- | --- |
| `fix-markdown-docs.py` | Normalize docs markdown before build |
| `generate-template-thumbnails.sh` | Regenerate template PNGs when needed |
