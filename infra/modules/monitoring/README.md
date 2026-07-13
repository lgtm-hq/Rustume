# Monitoring module

Grafana Cloud stack, authenticated Metrics Endpoint scrape of `/metrics`, Sentry project,
and a baseline dashboards-as-code JSON.

Metric names align with `crates/server/src/routes/metrics.rs` (Prometheus recorder) and
`rustume_rate_limit_keys` from `crates/server/src/middleware/rate_limit.rs`. HTTP route
histograms use conventional `http_server_*` names for when Axum instrumentation lands ([#335](https://github.com/lgtm-hq/Rustume/issues/335)).

## Usage

```hcl
module "monitoring" {
  source = "../modules/monitoring"

  stack_name       = "rustume-cloud"
  stack_slug       = "rustumecloud"
  metrics_scrape_url = "https://app.rustume.com/metrics"
  metrics_token    = var.metrics_token

  sentry_organization = "lgtm-hq"
  sentry_team         = "rustume"
}
```

Grafana Connections API credentials and Sentry auth tokens are supplied via provider
environment variables at apply time — never in committed tfvars.
