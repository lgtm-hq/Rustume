output "environment" {
  description = "Active environment label."
  value       = var.environment
}

output "neon_project_id" {
  description = "Neon project identifier."
  value       = module.neon.project_id
}

output "database_url" {
  description = "Application database URL."
  value       = module.neon.database_url
  sensitive   = true
}

output "r2_assets_bucket" {
  description = "Assets bucket name."
  value       = module.r2.assets_bucket_name
}

output "r2_backups_bucket" {
  description = "Backups bucket name."
  value       = module.r2.backups_bucket_name
}

output "app_fqdn" {
  description = "Rustume Cloud application hostname."
  value       = module.cloudflare_dns.app_fqdn
}

output "grafana_stack_url" {
  description = "Grafana Cloud stack URL."
  value       = module.monitoring.grafana_stack_url
}

output "railway_service_id" {
  description = "Railway service identifier."
  value       = module.railway.service_id
}

output "custom_hostname_placeholder" {
  description = "Hook for future custom-hostname work (#336)."
  value       = module.cloudflare_dns.custom_hostname_placeholder
}
