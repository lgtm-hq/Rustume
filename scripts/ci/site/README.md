# Site CI scripts

| Script | Purpose |
| --- | --- |
| `build.sh` | Build Astro site (`ASTRO_BASE` defaults from `defaults.env`) |
| `check.sh` | `astro check` and dependency install |
| `test.sh` | Vitest with coverage |
| `test-python.sh` | Pytest for `tests/scripts/ci/` |
| `test-all.sh` | `test.sh` + `test-python.sh` |
| `prepare-lychee-action-args.sh` | Strip duplicate lychee flags for `lychee-action` |

## Astro base path

[`defaults.env`](defaults.env) defines `ASTRO_BASE_DEFAULT` (currently `/Rustume/`). [`build.sh`](build.sh) and the root [`Makefile`](../../Makefile) `SITE_ASTRO_BASE` target read that value — do not duplicate the path elsewhere.

| Context | `ASTRO_BASE` |
| --- | --- |
| Local `make site-dev` / `site-build` | `ASTRO_BASE_DEFAULT` from `defaults.env` |
| `site-quality.yml` link check build | `/` (root-relative hrefs under `dist/`) |
| `deploy-pages.yml` production deploy | `ASTRO_BASE_DEFAULT` via `build.sh` |

## GitHub Pages and repository About URL

1. **Pages** (already enabled): **Settings → Pages → Build and deployment → Source: GitHub Actions**. The [`deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) workflow publishes `apps/site/dist`.
2. **About URL** (manual, one-time): On the repository home page, click **About** (gear) → set **Website** to `https://lgtm-hq.github.io/Rustume/`. This is the link shown on the repo profile; it does not affect the Pages deploy itself.

Live docs URL: `https://lgtm-hq.github.io/Rustume/`
