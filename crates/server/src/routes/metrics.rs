use axum::response::IntoResponse;
use std::sync::OnceLock;

use metrics_exporter_prometheus::PrometheusHandle;

static PROMETHEUS: OnceLock<PrometheusHandle> = OnceLock::new();

pub fn init_metrics() {
    let _ = PROMETHEUS.get_or_init(|| {
        metrics_exporter_prometheus::PrometheusBuilder::new()
            .install_recorder()
            .expect("failed to install Prometheus recorder")
    });
}

pub async fn metrics() -> impl IntoResponse {
    PROMETHEUS
        .get()
        .map(PrometheusHandle::render)
        .unwrap_or_default()
}
