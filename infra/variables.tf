variable "environment" {
  description = "Deployment environment label (staging or production)."
  type        = string
}

variable "neon_project_name" {
  description = "Neon project name."
  type        = string
}

variable "neon_region_id" {
  description = "Neon region identifier."
  type        = string
  default     = "aws-us-west-2"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account identifier."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone identifier for rustume.com."
  type        = string
}

variable "r2_assets_bucket_name" {
  description = "R2 assets bucket name."
  type        = string
}

variable "r2_backups_bucket_name" {
  description = "R2 backups bucket name."
  type        = string
}

variable "r2_read_write_permission_group_id" {
  description = "Cloudflare permission group ID for R2 Object Read & Write."
  type        = string
}

variable "railway_cname_target" {
  description = "Railway custom-domain CNAME target for app.rustume.com."
  type        = string
}

variable "railway_project_id" {
  description = "Railway project identifier."
  type        = string
}

variable "railway_environment_id" {
  description = "Railway environment identifier."
  type        = string
}

variable "railway_source_image" {
  description = "GHCR image reference deployed to Railway."
  type        = string
}

variable "grafana_stack_name" {
  description = "Grafana Cloud stack name."
  type        = string
}

variable "grafana_stack_slug" {
  description = "Grafana Cloud stack slug."
  type        = string
}

variable "metrics_scrape_url" {
  description = "Public HTTPS /metrics endpoint."
  type        = string
}

variable "sentry_organization" {
  description = "Sentry organization slug."
  type        = string
}

variable "sentry_team" {
  description = "Sentry team slug."
  type        = string
}

variable "cors_origin" {
  description = "Allowed browser origin for Rustume Cloud."
  type        = string
}

variable "workos_redirect_uri" {
  description = "WorkOS AuthKit redirect URI."
  type        = string
}

# --- Sensitive (never commit values) ---

variable "neon_api_token" {
  description = "Neon API token."
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token."
  type        = string
  sensitive   = true
  default     = null
}

variable "grafana_cloud_access_policy_token" {
  description = "Grafana Cloud access policy token for stack management."
  type        = string
  sensitive   = true
  default     = null
}

variable "metrics_token" {
  description = "Bearer token protecting GET /metrics."
  type        = string
  sensitive   = true
  default     = null
}

variable "sentry_auth_token" {
  description = "Sentry user auth token."
  type        = string
  sensitive   = true
  default     = null
}

variable "railway_api_token" {
  description = "Railway API token."
  type        = string
  sensitive   = true
  default     = null
}

variable "ghcr_read_token" {
  description = "GitHub PAT with read:packages for GHCR pulls."
  type        = string
  sensitive   = true
  default     = null
}

variable "ghcr_username" {
  description = "GitHub username for GHCR auth."
  type        = string
  default     = null
}

variable "workos_client_id" {
  description = "WorkOS client ID."
  type        = string
  sensitive   = true
  default     = null
}

variable "workos_api_key" {
  description = "WorkOS API key."
  type        = string
  sensitive   = true
  default     = null
}

variable "session_secret" {
  description = "Cookie signing secret."
  type        = string
  sensitive   = true
  default     = null
}
