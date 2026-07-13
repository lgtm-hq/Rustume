terraform {
  required_version = ">= 1.5.0"

  required_providers {
    neon = {
      source  = "terraform-community-providers/neon"
      version = "~> 0.1.15"
    }
  }
}
