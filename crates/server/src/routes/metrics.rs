//! Prometheus metrics endpoint for Rustume Cloud observability.

use axum::{
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use std::sync::OnceLock;
use subtle::ConstantTimeEq;
use tracing::warn;

use metrics_exporter_prometheus::PrometheusHandle;

use crate::error::ApiError;

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
pub async fn metrics(headers: HeaderMap) -> Result<Response, ApiError> {
    if !metrics_authorized(&headers) {
        return Err(ApiError::unauthorized("Unauthorized"));
    }

    let body = PROMETHEUS
        .get()
        .map(PrometheusHandle::render)
        .unwrap_or_default();

    Ok((StatusCode::OK, body).into_response())
}

fn metrics_authorized(headers: &HeaderMap) -> bool {
    let expected = match std::env::var("METRICS_TOKEN") {
        Ok(token) if !token.is_empty() => token,
        _ => return false,
    };

    let Some(auth) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    else {
        return false;
    };

    let Some(bearer) = auth.strip_prefix("Bearer ") else {
        return false;
    };

    constant_time_eq(bearer, &expected)
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}
