module "neon" {
  source = "./modules/neon"

  project_name = var.neon_project_name
  region_id    = var.neon_region_id
}

module "r2" {
  source = "./modules/r2"

  account_id                        = var.cloudflare_account_id
  assets_bucket_name                = var.r2_assets_bucket_name
  backups_bucket_name               = var.r2_backups_bucket_name
  r2_read_write_permission_group_id = var.r2_read_write_permission_group_id
}

module "cloudflare_dns" {
  source = "./modules/cloudflare-dns"

  zone_id              = var.cloudflare_zone_id
  railway_cname_target = var.railway_cname_target
}

module "monitoring" {
  source = "./modules/monitoring"

  stack_name         = var.grafana_stack_name
  stack_slug         = var.grafana_stack_slug
  metrics_scrape_url = var.metrics_scrape_url
  metrics_token      = var.metrics_token

  sentry_organization = var.sentry_organization
  sentry_team         = var.sentry_team
}

module "railway" {
  source = "./modules/railway"

  project_id     = var.railway_project_id
  environment_id = var.railway_environment_id
  source_image   = var.railway_source_image

  ghcr_read_token = var.ghcr_read_token
  ghcr_username   = var.ghcr_username

  environment_variables = {
    RUSTUME_CLOUD       = "true"
    DATABASE_URL        = module.neon.database_url
    WORKOS_CLIENT_ID    = var.workos_client_id
    WORKOS_API_KEY      = var.workos_api_key
    WORKOS_REDIRECT_URI = var.workos_redirect_uri
    SESSION_SECRET      = var.session_secret
    CORS_ORIGIN         = var.cors_origin
    METRICS_TOKEN       = var.metrics_token
    SENTRY_DSN          = module.monitoring.sentry_dsn
  }
}
