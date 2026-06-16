variable "project_id" {
  description = "Railway project identifier."
  type        = string
}

variable "environment_id" {
  description = "Railway environment identifier for service-scoped variables."
  type        = string
}

variable "service_name" {
  description = "Railway service name."
  type        = string
  default     = "rustume-server"
}

variable "source_image" {
  description = "GHCR image reference (tag or digest). Example: ghcr.io/lgtm-hq/rustume:main"
  type        = string
}

variable "ghcr_read_token" {
  description = "GitHub PAT with read:packages for private ghcr.io/lgtm-hq/rustume pulls. Must be set together with ghcr_username, or both left null; setting only one fails plan validation."
  type        = string
  sensitive   = true
  default     = null
}

variable "ghcr_username" {
  description = "GitHub username for GHCR auth. Must be set together with ghcr_read_token, or both left null; setting only one fails plan validation."
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Runtime env vars for the Rustume server (RUSTUME_CLOUD, DATABASE_URL, WorkOS, etc.). Values are redacted in plan/state via railway_variable.value sensitivity; do not mark this map sensitive or for_each will fail."
  type        = map(string)
  default     = {}
}

variable "regions" {
  description = "Railway regions and replica counts."
  type = list(object({
    region       = string
    num_replicas = optional(number, 1)
  }))
  default = [{
    region       = "us-west2"
    num_replicas = 1
  }]
}
