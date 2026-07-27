# Site CI scripts

| Script | Purpose |
| --- | --- |
| `build.sh` | Build Astro site (`ASTRO_BASE` defaults from `defaults.env`) |
| `check.sh` | `astro check` and dependency install |
| `check-contrast.sh` | WCAG AA contrast gate for `src/styles/craft-theme.css` |
| `test.sh` | Vitest with coverage |
| `test-python.sh` | Pytest for `tests/scripts/ci/` |
| `test-all.sh` | `test.sh` + `test-python.sh` |
| `e2e.sh` | Build `dist/`, serve it, verify the served build, run the Playwright a11y suites |
| `assert-served-build.sh` | Staleness guard: the served site must be the build under test |
| `preview-serve.sh` | `astro preview` with `ASTRO_BASE` from `defaults.env` |
| `preview-pages-local.sh` | Build dist + optional local coverage bundles for manual Pages preview |

## Astro base path

[`defaults.env`](defaults.env) defines `ASTRO_BASE_DEFAULT` (currently `/` for the
`rustume.com` custom domain).
[`build.sh`](build.sh) and the root [`Makefile`](../../../Makefile) `SITE_ASTRO_BASE` target read
that value — do not duplicate the path elsewhere.

| Context | `ASTRO_BASE` |
| --- | --- |
| Local `make site-dev` / `site-build` | `ASTRO_BASE_DEFAULT` from `defaults.env` |
| `site-quality.yml` link check build | `/` (root-relative hrefs under `dist/`; lychee via `reusable-site-quality`) |
| `deploy-pages.yml` production deploy | `ASTRO_BASE_DEFAULT` via `build.sh` |
| `test-e2e-site.yml` accessibility suites | `ASTRO_BASE_DEFAULT` via `build.sh` (`e2e.sh`) |

## Site accessibility E2E (`e2e.sh`)

[`.github/workflows/test-e2e-site.yml`](../../../.github/workflows/test-e2e-site.yml)
runs the `apps/site/e2e` Playwright suites through lgtm-ci's
`reusable-test-e2e-playwright` with `e2e.sh` as its `test-command`. The suites scan the
production build served by `astro preview` — never a dev server — so CI exercises what
deploys.

`e2e.sh` starts that server itself (rather than leaving it to Playwright's `webServer`,
which `playwright.config.ts` lets it reuse via `PLAYWRIGHT_REUSE_SERVER=1`) so the
**staleness guard** can run before the suite:

1. `dist/index.html` and `dist/pagefind/pagefind.js` must be newer than the build step —
   a restored cache or skipped build cannot pass as a build.
2. `dist/e2e-build-stamp.txt` records a sha256 fingerprint of every other file in
   `dist/`, the commit, and the run id/attempt plus build timestamp.
3. [`assert-served-build.sh`](assert-served-build.sh) fetches that stamp over HTTP before
   and after the suite and fails loudly on a mismatch, a non-200, or no response.

This complements `apps/site/scripts/e2e-build.mjs`, which refuses to start when the port
is busy (`astro preview` silently hops to the next free port). That keeps a foreign
server from displacing ours; the guard proves the server that actually answered is
serving this build. Motivation: turbo-themes#824, where a suite ran green against a
silently stale site.

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
| `https://rustume.com/` | Astro documentation site |
| `https://rustume.com/coverage-rust/` | Rust `cargo llvm-cov` HTML report |
| `https://rustume.com/coverage-web/` | Web Vitest HTML report |

**Settings → Pages → Build and deployment → Source: GitHub Actions** (not “Deploy from a branch”).

**Custom domain** (manual): repository **Settings → Pages → Custom domain** → `rustume.com`.

**About URL** (manual): repository **About** → **Website** → `https://rustume.com`.

## Local preview (manual check before merge)

```bash
# Full preview: site + web + rust coverage (rust step is slow)
./scripts/ci/site/preview-pages-local.sh

# Docs only, then preview server
PREVIEW_INCLUDE_RUST=0 PREVIEW_INCLUDE_WEB=0 ./scripts/ci/site/preview-pages-local.sh

# Build dist only (no server)
PREVIEW_SERVE=0 ./scripts/ci/site/preview-pages-local.sh
```

Open [http://127.0.0.1:4321/](http://127.0.0.1:4321/) at the site root. Use `make site-preview`,
`bun run preview` in `apps/site`, or `preview-pages-local.sh`; all load `ASTRO_BASE`
via `preview-serve.sh`.

Coverage trees appear under `/coverage-rust/` and `/coverage-web/` when generated.

## CI scripts (site quality)

| Script | Purpose |
| --- | --- |
| `fix-markdown-docs.py` | Normalize docs markdown before build |
| `generate-template-thumbnails.sh` | Regenerate template PNGs when needed |
