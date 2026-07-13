locals {
  retention_seconds = var.backup_retention_days * 86400
  token_ip_condition = length(var.token_allowed_ip_ranges) > 0 ? {
    request_ip = {
      in = var.token_allowed_ip_ranges
    }
  } : null
  assets_bucket_resource  = "com.cloudflare.edge.r2.bucket.${var.account_id}_${var.bucket_jurisdiction}_${cloudflare_r2_bucket.assets.name}"
  backups_bucket_resource = "com.cloudflare.edge.r2.bucket.${var.account_id}_${var.bucket_jurisdiction}_${cloudflare_r2_bucket.backups.name}"
}

resource "cloudflare_r2_bucket" "assets" {
  account_id    = var.account_id
  name          = var.assets_bucket_name
  location      = var.location
  jurisdiction  = var.bucket_jurisdiction
  storage_class = "Standard"
}

resource "cloudflare_r2_bucket" "backups" {
  account_id    = var.account_id
  name          = var.backups_bucket_name
  location      = var.location
  jurisdiction  = var.bucket_jurisdiction
  storage_class = "Standard"
}

resource "cloudflare_r2_bucket_lifecycle" "backups" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.backups.name

  rules = [{
    id      = "expire-backups-after-retention"
    enabled = true
    conditions = {
      prefix = ""
    }
    delete_objects_transition = {
      condition = {
        type    = "Age"
        max_age = local.retention_seconds
      }
    }
    abort_multipart_uploads_transition = {
      condition = {
        type    = "Age"
        max_age = local.retention_seconds
      }
    }
  }]

  lifecycle {
    precondition {
      condition     = var.backup_retention_days > 0
      error_message = "backup_retention_days must be a positive integer."
    }
  }
}

resource "cloudflare_r2_bucket_lock" "backups_versioning" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.backups.name

  rules = [{
    id      = "retain-backup-versions"
    enabled = true
    prefix  = ""
    condition = {
      type            = "Age"
      max_age_seconds = local.retention_seconds
    }
  }]
}

resource "cloudflare_api_token" "assets" {
  name = var.assets_token_name

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = var.r2_read_write_permission_group_id
    }]
    resources = jsonencode({
      (local.assets_bucket_resource) = "*"
    })
  }]

  condition = local.token_ip_condition

  lifecycle {
    precondition {
      condition     = !var.enforce_ip_allowlist || length(var.token_allowed_ip_ranges) > 0
      error_message = "Set token_allowed_ip_ranges before staging or production apply."
    }
  }
}

resource "cloudflare_api_token" "backups" {
  name = var.backups_token_name

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = var.r2_read_write_permission_group_id
    }]
    resources = jsonencode({
      (local.backups_bucket_resource) = "*"
    })
  }]

  condition = local.token_ip_condition

  lifecycle {
    precondition {
      condition     = !var.enforce_ip_allowlist || length(var.token_allowed_ip_ranges) > 0
      error_message = "Set token_allowed_ip_ranges before staging or production apply."
    }
  }
}
