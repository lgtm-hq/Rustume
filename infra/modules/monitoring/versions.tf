terraform {
  required_version = ">= 1.5.0"

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.41.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14.13"
    }
  }
}
