environment = "production"

neon_project_name = "rustume-cloud-production"
neon_region_id    = "aws-us-west-2"

cloudflare_account_id = "00000000000000000000000000000000"
cloudflare_zone_id    = "00000000000000000000000000000000"

r2_assets_bucket_name  = "rustume-assets-production"
r2_backups_bucket_name = "rustume-backups-production"
# Look up via Cloudflare API/dashboard before apply.
r2_read_write_permission_group_id = "00000000000000000000000000000000"
# Replace with Railway egress and operator CIDRs before apply (see infra/modules/r2/README.md).
r2_token_allowed_ip_ranges = ["203.0.113.10/32"]

railway_cname_target   = "responsible-celebration-production-8280.up.railway.app"
railway_project_id     = "83fe27c6-ab4b-444e-97bb-f7773c92c87a"
railway_environment_id = "78af5529-02bd-42b6-8436-99f6d0e39114"
railway_source_image   = "ghcr.io/lgtm-hq/rustume:main"

grafana_stack_name = "rustume-cloud-production"
grafana_stack_slug = "rustumecloudprod"
metrics_scrape_url = "https://app.rustume.com/metrics"

sentry_organization = "lgtm-hq"
sentry_team         = "rustume"

cors_origin         = "https://app.rustume.com"
workos_redirect_uri = "https://app.rustume.com/auth/callback"
