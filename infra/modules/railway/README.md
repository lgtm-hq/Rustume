# Railway module

Deploy Rustume Cloud from a CI-built GHCR image instead of a GitHub source build.

## Usage

```hcl
module "rustume_server" {
  source = "../modules/railway"

  project_id     = railway_project.rustume_cloud.id
  environment_id = railway_project.rustume_cloud.default_environment.id
  service_name   = "rustume-server"

  # Staging: track main CI artifact. Production: semver tag or digest pin.
  source_image = "ghcr.io/lgtm-hq/rustume:main"

  ghcr_read_token = var.ghcr_read_token
  ghcr_username   = var.github_username

  environment_variables = {
    RUSTUME_CLOUD        = "true"
    DATABASE_URL         = var.database_url
    WORKOS_CLIENT_ID     = var.workos_client_id
    WORKOS_API_KEY       = var.workos_api_key
    WORKOS_REDIRECT_URI  = var.workos_redirect_uri
    SESSION_SECRET       = var.session_secret
    CORS_ORIGIN          = var.cors_origin
  }
}
```

## Image references

| Environment | Recommended reference | Notes |
| --- | --- | --- |
| Staging | `ghcr.io/lgtm-hq/rustume:main` | Updated on every path-filtered `main` push |
| Staging (pinned) | `ghcr.io/lgtm-hq/rustume:sha-<commit>` | Reproducible deploy of a specific CI build |
| Production | `ghcr.io/lgtm-hq/rustume:<semver>` | Published on `v*.*.*` tags (`latest` also available) |
| Production (pinned) | `ghcr.io/lgtm-hq/rustume@sha256:…` | Digest pin from the release workflow run |

Do **not** set `RAILWAY_DOCKERFILE_PATH`, `source_repo`, or `config_path` when using
`source_image`. Runtime configuration belongs in `environment_variables` only.

## GHCR credentials

If Railway cannot pull `ghcr.io/lgtm-hq/rustume` without auth, create a GitHub PAT with
`read:packages`, set `ghcr_username` to your GitHub username, and pass the PAT as
`ghcr_read_token`. Railway accepts GHCR tokens in the registry password field; see the
registry password field; see
[Railway private registries](https://docs.railway.com/builds/private-registries).

## Migration from source builds

1. Merge a CI image for the target ref (`main` or release tag).
2. Switch the Railway service source to the GHCR image (dashboard or this module).
3. Add GHCR credentials if pulls fail.
4. Remove `RAILWAY_DOCKERFILE_PATH` and delete `docker/Dockerfile.railway`.
5. Redeploy and run staging smoke tests (health, WorkOS login, resume CRUD).
