variable "account_id" {
  description = "Cloudflare account identifier."
  type        = string
}

variable "assets_bucket_name" {
  description = "R2 bucket for user-uploaded assets."
  type        = string
}

variable "backups_bucket_name" {
  description = "R2 bucket for database backups."
  type        = string
}

variable "location" {
  description = "R2 bucket location (for example WEUR, ENAM)."
  type        = string
  default     = "ENAM"
}

variable "backup_retention_days" {
  description = "Days to retain backup objects before lifecycle deletion."
  type        = number
  default     = 30
}

variable "assets_token_name" {
  description = "Display name for the scoped assets-bucket API token."
  type        = string
  default     = "rustume-r2-assets"
}

variable "backups_token_name" {
  description = "Display name for the scoped backups-bucket API token."
  type        = string
  default     = "rustume-r2-backups"
}

variable "r2_read_write_permission_group_id" {
  description = "Cloudflare permission group ID for R2 Object Read & Write."
  type        = string
}

variable "bucket_jurisdiction" {
  description = "R2 bucket jurisdiction segment used in API token resource identifiers (default for non-jurisdiction buckets)."
  type        = string
  default     = "default"
}

variable "token_allowed_ip_ranges" {
  description = "CIDR ranges restricting R2 API token usage. Leave empty only for local validation; set before production apply."
  type        = list(string)
  default     = []

  validation {
    condition     = !var.enforce_ip_allowlist || length(var.token_allowed_ip_ranges) > 0
    error_message = "Set token_allowed_ip_ranges before staging or production apply."
  }
}

variable "enforce_ip_allowlist" {
  description = "When true, require non-empty token_allowed_ip_ranges (set by root for staging/production)."
  type        = bool
  default     = false
}
