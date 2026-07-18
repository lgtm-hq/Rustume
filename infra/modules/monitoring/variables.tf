variable "stack_name" {
  description = "Grafana Cloud stack name."
  type        = string
}

variable "stack_slug" {
  description = "Grafana Cloud stack slug (URL-safe identifier)."
  type        = string
}

variable "stack_description" {
  description = "Human-readable Grafana stack description."
  type        = string
  default     = "Rustume Cloud observability"
}

variable "stack_region" {
  description = "Grafana Cloud region slug."
  type        = string
  default     = "us"
}

variable "metrics_scrape_url" {
  description = "Public HTTPS /metrics endpoint for Grafana Cloud to scrape."
  type        = string
}

variable "metrics_token" {
  description = "Bearer token for authenticated /metrics scrapes (METRICS_TOKEN)."
  type        = string
  sensitive   = true
}

variable "metrics_scrape_interval_seconds" {
  description = "Grafana Metrics Endpoint scrape interval (30, 60, or 120)."
  type        = number
  default     = 60
}

variable "sentry_organization" {
  description = "Sentry organization slug."
  type        = string
}

variable "sentry_team" {
  description = "Sentry team slug receiving the Rustume project."
  type        = string
}

variable "sentry_project_name" {
  description = "Sentry project display name."
  type        = string
  default     = "rustume-cloud"
}

variable "sentry_project_slug" {
  description = "Sentry project slug."
  type        = string
  default     = "rustume-cloud"
}

variable "dashboard_folder_title" {
  description = "Grafana folder title for Rustume dashboards."
  type        = string
  default     = "Rustume Cloud"
}
