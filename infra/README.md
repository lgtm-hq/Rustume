# Rustume Cloud infrastructure

Terraform modules and environment wiring for the operated Rustume Cloud stack.

## Layout

| Path | Purpose |
| --- | --- |
| `modules/railway/` | Railway service deployed from CI-built GHCR images |
| `modules/neon/` | Neon PostgreSQL project, branch, role, and database |
| `modules/r2/` | Cloudflare R2 assets + backup buckets, lifecycle, scoped tokens |
| `modules/cloudflare-dns/` | `rustume.com` apex → Pages, `app` → Railway |
| `modules/monitoring/` | Grafana Cloud stack, `/metrics` scrape, Sentry, baseline dashboard |
| `main.tf`, `variables.tf`, `outputs.tf` | Root module composing all providers |
| `environments/*.tfvars` | Non-secret per-environment placeholders |

## Codified vs manual ([#333](https://github.com/lgtm-hq/Rustume/issues/333))

| Codified in this repo | Manual / human step |
| --- | --- |
| Module definitions, env roots, dashboard JSON | Remote state backend configuration |
| `terraform fmt` + `validate` in CI | `terraform import` of live resources |
| Placeholder tfvars (no secrets) | Provider API tokens / secrets injection |
| | `terraform plan` / `apply` against production |

Secrets use `sensitive = true` variables, which redact values in logs and CLI output only.
Set required inputs before `terraform plan` or `terraform apply`:

- Module variables: export `TF_VAR_<name>` (for example `TF_VAR_neon_api_token`).
- Provider credentials: use each provider's documented environment variables when a
  `TF_VAR_*` token is not set (`NEON_TOKEN`, `CLOUDFLARE_API_TOKEN`, etc.).

Never commit token values or `*.auto.tfvars` with credentials.

## Deploy model

Rustume Cloud does **not** compile Rust on Railway. CI publishes signed images from
`docker/Dockerfile`; Railway pulls the pre-built artifact. See
[docs/operations/rustume-cloud-deploy.md](../docs/operations/rustume-cloud-deploy.md).

## Local validation

```bash
bash scripts/ci/terraform/validate.sh
```

## Applying (operators only)

```bash
cd infra
terraform init            # configure backend first
terraform plan -var-file=environments/production.tfvars
# terraform apply ...     # human gate — not run in CI
```
