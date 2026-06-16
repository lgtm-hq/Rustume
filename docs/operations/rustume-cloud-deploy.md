# Rustume Cloud deployment

Operated Rustume Cloud deploys from CI-built container images published to GHCR. Railway
(or Terraform via `infra/modules/railway/`) pulls the image; it does not compile Rust from
the GitHub repository.

## Pipeline

```text
merge to main / push v*.*.* tag
  -> .github/workflows/docker-build-publish.yml
  -> ghcr.io/lgtm-hq/rustume (signed, scanned, multi-arch)
  -> Railway redeploy (image pull)
```

Canonical build definition: `docker/Dockerfile` only. The interim
`docker/Dockerfile.railway` source-build workaround has been removed now that Railway
deploys from GHCR.

## Image tags

Published by [lgtm-ci reusable-docker](https://github.com/lgtm-hq/lgtm-ci) metadata rules:

| Tag | Trigger | Rustume Cloud use |
| --- | --- | --- |
| `main` | Path-filtered push to `main` | **Staging** floating deploy |
| `sha-<commit>` | Same build as `main` / release | **Staging/production pin** (reproducible) |
| `<semver>`, `latest` | `v*.*.*` git tag | **Production** release deploy |
| `cache` | CI registry cache | Internal only — do not deploy |

### Staging (`rustume-cloud` Railway project)

- **Default:** `ghcr.io/lgtm-hq/rustume:main`
- **Pinned:** `ghcr.io/lgtm-hq/rustume:sha-<commit>` from the merge commit under test
- After each `main` publish, redeploy staging (Railway watches the tag or trigger manually)

### Production

- **Default:** `ghcr.io/lgtm-hq/rustume:<semver>` matching the released version
- **Preferred:** digest pin `ghcr.io/lgtm-hq/rustume@sha256:…` from the release workflow run
- Do not deploy `:main` to production

Resolve digest from the workflow run or:

```bash
docker buildx imagetools inspect ghcr.io/lgtm-hq/rustume:sha-<commit> \
  --format '{{json .Manifest}}'
```

## Railway service configuration

Project: `rustume-cloud` (staging service historically named `responsible-celebration`).

### Switch source to GHCR

1. Open the service **Settings → Source**.
2. Change source from **GitHub repository** to **Docker image**.
3. Set image to `ghcr.io/lgtm-hq/rustume:main` (staging) or the release tag/digest.
4. Under **Registry credentials**, add a GitHub PAT with `read:packages` if pulls fail.
   Railway accepts GHCR tokens per [private registry docs](https://docs.railway.com/builds/private-registries).
5. Remove source-build settings:
   - `RAILWAY_DOCKERFILE_PATH` (and any `Dockerfile.railway` reference)
   - GitHub repo / branch deploy hooks used only for source builds
6. Keep runtime variables unchanged (`RUSTUME_CLOUD`, `DATABASE_URL`, WorkOS, `SESSION_SECRET`,
   `CORS_ORIGIN`, observability secrets, etc.).

### Terraform

Use `infra/modules/railway/` with `source_image` and `environment_variables`. Do not set
`source_repo`, `config_path`, or Dockerfile paths on the service.

## Verification

After switching staging to GHCR:

1. Confirm the latest `main` workflow published `ghcr.io/lgtm-hq/rustume:main`.
2. Trigger a Railway redeploy; build logs should show **image pull**, not Rust compile.
3. Deploy time should drop from ~20–30+ minutes (source build) to a few minutes (pull + start).
4. Smoke test:
   - `GET /health` returns success
   - WorkOS login completes
   - Resume create / read / update / delete via the UI or API

## Related

- [Deployment](../deployment.md) — self-hosting and GHCR tags for operators
- [Issue #252](https://github.com/lgtm-hq/Rustume/issues/252) — migration tracking
- [Issue #243](https://github.com/lgtm-hq/Rustume/issues/243) — Phase 1 Terraform stack
