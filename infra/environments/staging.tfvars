environment = "staging"

neon_project_name = "rustume-cloud-staging"
neon_region_id    = "aws-us-west-2"

cloudflare_account_id = "00000000000000000000000000000000"
cloudflare_zone_id    = "00000000000000000000000000000000"

r2_assets_bucket_name             = "rustume-assets-staging"
r2_backups_bucket_name            = "rustume-backups-staging"
r2_read_write_permission_group_id = "00000000000000000000000000000000"

railway_cname_target   = "staging-placeholder.up.railway.app"
railway_project_id     = "00000000-0000-0000-0000-000000000000"
railway_environment_id = "00000000-0000-0000-0000-000000000000"
railway_source_image   = "ghcr.io/lgtm-hq/rustume:main"

grafana_stack_name = "rustume-cloud-staging"
grafana_stack_slug = "rustumecloudstg"
metrics_scrape_url = "https://app.staging.rustume.com/metrics"

sentry_organization = "lgtm-hq"
sentry_team         = "rustume"

cors_origin         = "https://app.staging.rustume.com"
workos_redirect_uri = "https://app.staging.rustume.com/auth/callback"
