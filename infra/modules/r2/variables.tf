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

variable "token_allowed_ip_ranges" {
  description = "Optional CIDR ranges restricting R2 API token usage."
  type        = list(string)
  default     = []
}
