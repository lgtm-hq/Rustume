//! Prometheus metrics endpoint for Rustume Cloud observability.

use axum::response::IntoResponse;
use std::sync::OnceLock;
use tracing::warn;

use metrics_exporter_prometheus::PrometheusHandle;

static PROMETHEUS: OnceLock<PrometheusHandle> = OnceLock::new();

/// Install the global Prometheus metrics recorder (idempotent).
pub fn init_metrics() {
    if PROMETHEUS.get().is_some() {
        return;
    }

    match metrics_exporter_prometheus::PrometheusBuilder::new().install_recorder() {
        Ok(handle) => {
            let _ = PROMETHEUS.set(handle);
        }
        Err(err) => warn!("failed to install Prometheus recorder: {err}"),
    }
}

/// Render all recorded metrics in Prometheus text format.
pub async fn metrics() -> impl IntoResponse {
    PROMETHEUS
        .get()
        .map(PrometheusHandle::render)
        .unwrap_or_default()
}
