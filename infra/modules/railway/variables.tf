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
  description = "GitHub PAT with read:packages for private ghcr.io/lgtm-hq/rustume pulls."
  type        = string
  sensitive   = true
  default     = null
}

variable "ghcr_username" {
  description = "GitHub username for GHCR auth. Omit when Railway supplies GHCR username."
  type        = string
  default     = null
}

variable "environment_variables" {
  description = "Runtime env vars for the Rustume server (RUSTUME_CLOUD, DATABASE_URL, WorkOS, etc.)."
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
    region       = "us-west1"
    num_replicas = 1
  }]
}
