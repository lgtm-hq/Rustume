resource "railway_service" "rustume" {
  name       = var.service_name
  project_id = var.project_id

  source_image = var.source_image

  dynamic "regions" {
    for_each = var.regions
    content {
      region       = regions.value.region
      num_replicas = regions.value.num_replicas
    }
  }

  source_image_registry_username = var.ghcr_read_token == null ? null : var.ghcr_username
  source_image_registry_password = var.ghcr_read_token

  lifecycle {
    precondition {
      condition     = (var.ghcr_read_token == null) == (var.ghcr_username == null)
      error_message = "ghcr_read_token and ghcr_username must both be set or both omitted."
    }
  }
}

resource "railway_variable" "runtime" {
  for_each = var.environment_variables

  name           = each.key
  value          = each.value
  environment_id = var.environment_id
  service_id     = railway_service.rustume.id
}
