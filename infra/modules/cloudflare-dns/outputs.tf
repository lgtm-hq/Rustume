output "apex_record_ids" {
  description = "Cloudflare record IDs for apex A records."
  value       = [for record in cloudflare_dns_record.apex_pages : record.id]
}

output "app_record_id" {
  description = "Cloudflare record ID for app.rustume.com."
  value       = cloudflare_dns_record.app_railway.id
}

output "app_fqdn" {
  description = "Application fully qualified domain name."
  value       = local.app_fqdn
}

output "custom_hostname_placeholder" {
  description = "Reserved for per-tenant custom hostnames ([#336](https://github.com/lgtm-hq/Rustume/issues/336))."
  value = {
    module_ready   = true
    zone_id        = var.zone_id
    suggested_type = "cloudflare_custom_hostname"
  }
}
