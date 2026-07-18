output "grafana_stack_id" {
  description = "Grafana Cloud stack identifier."
  value       = grafana_cloud_stack.rustume.id
}

output "grafana_stack_url" {
  description = "Grafana Cloud stack URL."
  value       = grafana_cloud_stack.rustume.url
}

output "prometheus_remote_write_endpoint" {
  description = "Hosted Prometheus remote-write endpoint."
  value       = grafana_cloud_stack.rustume.prometheus_remote_write_endpoint
}

output "metrics_scrape_job_id" {
  description = "Grafana Metrics Endpoint scrape job identifier."
  value       = grafana_connections_metrics_endpoint_scrape_job.rustume.id
}

output "sentry_project_id" {
  description = "Sentry project identifier."
  value       = sentry_project.rustume.id
}

output "sentry_dsn" {
  description = "Sentry DSN for server SENTRY_DSN."
  value       = data.sentry_key.rustume.dsn.public
  sensitive   = true
}

output "dashboard_uid" {
  description = "Baseline Grafana dashboard UID."
  value       = jsondecode(grafana_dashboard.baseline.config_json).uid
}
