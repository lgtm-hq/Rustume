variable "project_name" {
  description = "Neon project name."
  type        = string
}

variable "region_id" {
  description = "Neon region identifier (for example aws-us-west-2)."
  type        = string
  default     = "aws-us-west-2"
}

variable "pg_version" {
  description = "PostgreSQL major version for the Neon project."
  type        = number
  default     = 16

  validation {
    condition     = floor(var.pg_version) == var.pg_version && var.pg_version >= 14 && var.pg_version <= 18
    error_message = "pg_version must be an integer between 14 and 18."
  }
}

variable "branch_name" {
  description = "Primary branch name."
  type        = string
  default     = "main"
}

variable "database_name" {
  description = "Application database name."
  type        = string
  default     = "rustume"
}

variable "role_name" {
  description = "Application database role name."
  type        = string
  default     = "rustume_app"
}

variable "history_retention_seconds" {
  description = "Point-in-time recovery retention window in seconds."
  type        = number
  default     = 86400

  validation {
    condition = floor(var.history_retention_seconds) == var.history_retention_seconds && var.history_retention_seconds >= 0 && var.history_retention_seconds <= 2592000
    error_message = "history_retention_seconds must be an integer between 0 and 2592000."
  }
}

variable "endpoint_min_cu" {
  description = "Minimum compute units for the default branch endpoint."
  type        = number
  default     = 0.25
}

variable "endpoint_max_cu" {
  description = "Maximum compute units for the default branch endpoint."
  type        = number
  default     = 1
}
