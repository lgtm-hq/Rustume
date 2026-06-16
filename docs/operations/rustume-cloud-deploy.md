# Rustume Cloud deployment

Operated Rustume Cloud deploys from CI-built container images published to GHCR. Railway
(or Terraform via `infra/modules/railway/`) pulls the image; it does not compile Rust from
the GitHub repository.

## Pipeline

```text
merge to main / push v*.*.* tag
  -> .github/workflows/docker-build-publish.yml
  -> ghcr.io/lgtm-hq/rustume (signed, scanned, multi-arch)
  -> .github/workflows/deploy-railway-cloud.yml (production: :main + GraphQL deploy)
```

Canonical build definition: `docker/Dockerfile` only. The interim
`docker/Dockerfile.railway` source-build workaround has been removed now that Railway
deploys from GHCR.

## Image tags

Published by [lgtm-ci reusable-docker](https://github.com/lgtm-hq/lgtm-ci) metadata rules:

| Tag | Trigger | Rustume Cloud use |
| --- | --- | --- |
| `main` | Path-filtered push to `main` | **Production** floating deploy (single env) |
| `sha-<commit>` | Same build as `main` / release | **Pin** (reproducible rollback target) |
| `<semver>`, `latest` | `v*.*.*` git tag | Release deploy (future semver pinning) |
| `cache` | CI registry cache | Internal only — do not deploy |

### Production (`rustume-cloud` Railway project)

- **Default:** `ghcr.io/lgtm-hq/rustume:main`
- **Pinned:** `ghcr.io/lgtm-hq/rustume:sha-<commit>` from the merge commit under test
- After each `main` publish, `deploy-railway-cloud.yml` deploys production from `:main`

### CI automation

Repository secret `RAILWAY_API_TOKEN` (or `RAILWAY_TOKEN`) enables
`.github/workflows/deploy-railway-cloud.yml`. After each successful
`docker-build-publish` on `main`, CI:

1. Creates a GitHub Deployment entry for the commit
2. Runs `scripts/ci/railway/deploy-ghcr.sh --graphql-only` (GraphQL only — no Railway CLI)
3. Polls Railway deployment status via `scripts/ci/railway/poll-deploy-status.sh`
   (5-minute timeout, 10-second interval; fails on `FAILED`/`CRASHED`)
4. Updates the GitHub Deployment status to `success` or `failure`

**No auto-rollback:** On deploy failure, CI fails red. Investigate the root cause and
recover manually with `railway rollback` or by redeploying a known-good digest. Auto-rollback
can mask problems and is unsafe if database migrations ran.

Manual one-off (local — uses Railway CLI when installed, otherwise GraphQL):

```bash
RAILWAY_TOKEN=... scripts/ci/railway/deploy-ghcr.sh
```

Force GraphQL (same path as CI):

```bash
RAILWAY_TOKEN=... scripts/ci/railway/deploy-ghcr.sh --graphql-only
```

Trigger CI manually: **Actions → Deploy - Rustume Cloud (Railway) → Run workflow**
(use `dry_run: true` to log without deploying).

## Railway service configuration

Project: `rustume-cloud` (service historically named `responsible-celebration`).

### Switch source to GHCR

1. Open the service **Settings → Source**.
2. Change source from **GitHub repository** to **Docker image**.
3. Set image to `ghcr.io/lgtm-hq/rustume:main`.
4. Under **Registry credentials**, add a GitHub PAT with `read:packages` if pulls fail.
   Railway accepts GHCR tokens per [private registry docs](https://docs.railway.com/builds/private-registries).
   Use the `lgtm-hq/railway` machine account (or equivalent) username and store the PAT
   **only in Railway** — never in GitHub Actions or the repository.
5. Remove source-build settings:
   - `RAILWAY_DOCKERFILE_PATH` (and any `Dockerfile.railway` reference) — delete from
     the service if still present (dashboard or Terraform `environment_variables`)
   - GitHub repo / branch deploy hooks used only for source builds
6. **Disconnect GitHub source:** Settings → Source → Disconnect GitHub repo. The
   deploy workflow is the single deploy authority.
7. Keep runtime variables unchanged (`RUSTUME_CLOUD`, `DATABASE_URL`, WorkOS, `SESSION_SECRET`,
   `CORS_ORIGIN`, observability secrets, etc.).

### Post-merge CI validation

After merging the deploy egress fix and configuring registry credentials:

1. **Actions → Deploy - Rustume Cloud (Railway) → Run workflow** on `main` with
   `dry_run: true` (logs only; no deploy).
2. Re-run with `dry_run: false` to deploy `:main` via GraphQL.
3. Confirm a GitHub Deployment for environment `rustume-cloud` / `production` on the
   commit with status `success`.
4. Verify `GET /health` returns 200 on the Railway URL.

The `workflow_run` chain (docker publish → deploy) fires only when
`docker-build-publish.yml` completes on `main` with path-filtered changes.

### Terraform

Use `infra/modules/railway/` with `source_image` and `environment_variables`. Do not set
`source_repo`, `config_path`, or Dockerfile paths on the service.

## Verification

After switching to GHCR:

1. Confirm the latest `main` workflow published `ghcr.io/lgtm-hq/rustume:main`.
2. Trigger a deploy (CI or manual); build logs should show **image pull**, not Rust compile.
3. Deploy time should drop from ~20–30+ minutes (source build) to a few minutes (pull + start).
4. Confirm a GitHub Deployment entry appears on the commit with status `success`.
5. Smoke test:
   - `GET /health` returns success
   - WorkOS login completes
   - Resume create / read / update / delete via the UI or API

## Related

- [Deployment](../deployment.md) — self-hosting and GHCR tags for operators
- [Issue #252](https://github.com/lgtm-hq/Rustume/issues/252) — GHCR migration (closed)
- [Issue #299](https://github.com/lgtm-hq/Rustume/issues/299) — CI deploy automation
- [Issue #243](https://github.com/lgtm-hq/Rustume/issues/243) — Rustume Cloud parent epic
