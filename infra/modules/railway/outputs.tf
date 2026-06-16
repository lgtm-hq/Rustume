output "service_id" {
  description = "Railway service identifier."
  value       = railway_service.rustume.id
}

output "service_name" {
  description = "Railway service name."
  value       = railway_service.rustume.name
}

output "source_image" {
  description = "Configured GHCR image reference."
  value       = var.source_image
}
