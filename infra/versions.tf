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
      version = "~> 0.15.0"
    }
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.6.1"
    }
  }
}

provider "neon" {
  token = var.neon_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "grafana" {
  cloud_access_policy_token    = var.grafana_cloud_access_policy_token
  connections_api_url          = var.grafana_connections_api_url
  connections_api_access_token = var.grafana_connections_api_access_token
}

provider "sentry" {
  token = var.sentry_auth_token
}

provider "railway" {
  token = var.railway_api_token
}
