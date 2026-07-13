locals {
  account_resource  = "com.cloudflare.api.account.${var.account_id}"
  retention_seconds = var.backup_retention_days * 86400
  token_ip_condition = length(var.token_allowed_ip_ranges) > 0 ? {
    request_ip = {
      in = var.token_allowed_ip_ranges
    }
  } : null
}

resource "cloudflare_r2_bucket" "assets" {
  account_id    = var.account_id
  name          = var.assets_bucket_name
  location      = var.location
  storage_class = "Standard"
}

resource "cloudflare_r2_bucket" "backups" {
  account_id    = var.account_id
  name          = var.backups_bucket_name
  location      = var.location
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
      (local.account_resource) = "*"
    })
  }]

  condition = local.token_ip_condition
}

resource "cloudflare_api_token" "backups" {
  name = var.backups_token_name

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = var.r2_read_write_permission_group_id
    }]
    resources = jsonencode({
      (local.account_resource) = "*"
    })
  }]

  condition = local.token_ip_condition
}
