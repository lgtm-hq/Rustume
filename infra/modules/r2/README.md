# R2 module

Cloudflare R2 buckets for Rustume Cloud assets and database backups, with lifecycle
retention, object-lock versioning on backups, and scoped API tokens.

## Usage

```hcl
module "r2" {
  source = "../modules/r2"

  account_id          = var.cloudflare_account_id
  assets_bucket_name  = "rustume-assets-production"
  backups_bucket_name = "rustume-backups-production"
  backup_retention_days = 30

  # Cloudflare dashboard → Account API tokens → permission group ID for R2 Object Read & Write.
  r2_read_write_permission_group_id = var.r2_permission_group_id
}
```

Token values are sensitive outputs — inject into Railway/CI secrets at apply time, never
in tfvars committed to git.

## Notes

- Lifecycle `max_age` is in **seconds** (provider quirk).
- API tokens are scoped to individual buckets via
  `com.cloudflare.edge.r2.bucket.<account>_<jurisdiction>_<bucket>` resources.
- Set `token_allowed_ip_ranges` before production apply; empty defaults are for CI
  validation only.
- Bucket-scoped token policies depend on Cloudflare permission-group IDs; look up via
  dashboard or API before apply.
