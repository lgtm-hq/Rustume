locals {
  endpoint_cu_valid = var.endpoint_min_cu > 0 && var.endpoint_max_cu >= var.endpoint_min_cu
}

resource "neon_project" "rustume" {
  name              = var.project_name
  region_id         = var.region_id
  pg_version        = var.pg_version
  history_retention = var.history_retention_seconds

  branch = {
    name = var.branch_name
    endpoint = {
      min_cu = var.endpoint_min_cu
      max_cu = var.endpoint_max_cu
    }
  }

  lifecycle {
    precondition {
      condition     = local.endpoint_cu_valid
      error_message = "endpoint_max_cu must be greater than or equal to endpoint_min_cu and both must be positive."
    }
  }
}

resource "neon_role" "app" {
  project_id = neon_project.rustume.id
  branch_id  = neon_project.rustume.branch.id
  name       = var.role_name
}

resource "neon_database" "app" {
  project_id = neon_project.rustume.id
  branch_id  = neon_project.rustume.branch.id
  name       = var.database_name
  owner_name = neon_role.app.name
}
