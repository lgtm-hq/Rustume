terraform {
  required_version = ">= 1.5.0"

  # Remote state backend is configured manually for live environments — see README.md (#333).
  # backend "s3" {
  #   bucket = "rustume-terraform-state"
  #   key    = "production/terraform.tfstate"
  #   region = "auto"
  # }

  required_providers {
    neon = {
      source  = "terraform-community-providers/neon"
      version = "~> 0.1.15"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.21.0"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.29.1"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14.13"
    }
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6.1"
    }
  }
}

provider "neon" {}

provider "cloudflare" {}

provider "grafana" {
  cloud_access_policy_token = var.grafana_cloud_access_policy_token
}

provider "sentry" {
  token = var.sentry_auth_token
}

provider "railway" {
  token = var.railway_api_token
}
