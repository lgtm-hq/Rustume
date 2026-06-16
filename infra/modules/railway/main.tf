locals {
  ghcr_token_provided = var.ghcr_read_token != null && trimspace(var.ghcr_read_token) != ""
  ghcr_user_provided  = var.ghcr_username != null && trimspace(var.ghcr_username) != ""
}

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

  source_image_registry_username = local.ghcr_token_provided ? var.ghcr_username : null
  source_image_registry_password = local.ghcr_token_provided ? var.ghcr_read_token : null

  lifecycle {
    precondition {
      condition     = local.ghcr_token_provided == local.ghcr_user_provided
      error_message = "ghcr_read_token and ghcr_username must both be set to non-empty values or both omitted."
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
