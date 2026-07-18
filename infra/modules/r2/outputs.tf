output "assets_bucket_name" {
  description = "Assets bucket name."
  value       = cloudflare_r2_bucket.assets.name
}

output "backups_bucket_name" {
  description = "Backups bucket name."
  value       = cloudflare_r2_bucket.backups.name
}

output "assets_token_id" {
  description = "Scoped assets-bucket API token identifier."
  value       = cloudflare_api_token.assets.id
}

output "assets_token_value" {
  description = "Scoped assets-bucket API token secret."
  value       = cloudflare_api_token.assets.value
  sensitive   = true
}

output "backups_token_id" {
  description = "Scoped backups-bucket API token identifier."
  value       = cloudflare_api_token.backups.id
}

output "backups_token_value" {
  description = "Scoped backups-bucket API token secret."
  value       = cloudflare_api_token.backups.value
  sensitive   = true
}
