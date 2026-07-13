locals {
  scrape_interval_valid = contains([30, 60, 120], var.metrics_scrape_interval_seconds)
}

resource "grafana_cloud_stack" "rustume" {
  name        = var.stack_name
  slug        = var.stack_slug
  description = var.stack_description
  region_slug = var.stack_region
}

resource "grafana_connections_metrics_endpoint_scrape_job" "rustume" {
  stack_id                    = grafana_cloud_stack.rustume.id
  name                        = "rustume-cloud-metrics"
  enabled                     = true
  url                         = var.metrics_scrape_url
  authentication_method       = "bearer"
  authentication_bearer_token = var.metrics_token
  scrape_interval_seconds     = var.metrics_scrape_interval_seconds

  lifecycle {
    precondition {
      condition     = local.scrape_interval_valid
      error_message = "metrics_scrape_interval_seconds must be 30, 60, or 120."
    }
  }
}

resource "grafana_folder" "rustume" {
  title = var.dashboard_folder_title
}

resource "grafana_dashboard" "baseline" {
  folder      = grafana_folder.rustume.uid
  config_json = file("${path.module}/dashboards/rustume-cloud-baseline.json")
}

resource "sentry_project" "rustume" {
  organization = var.sentry_organization
  teams        = [var.sentry_team]
  name         = var.sentry_project_name
  slug         = var.sentry_project_slug
  platform     = "rust"
}

data "sentry_key" "rustume" {
  organization = sentry_project.rustume.organization
  project      = sentry_project.rustume.slug
  first        = true
}
