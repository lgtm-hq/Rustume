//! Prometheus metrics endpoint for Rustume Cloud observability.

use axum::{
    extract::Query,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde::Deserialize;
use std::sync::OnceLock;
use subtle::ConstantTimeEq;
use tracing::warn;

use metrics_exporter_prometheus::PrometheusHandle;

use crate::error::ApiError;

static PROMETHEUS: OnceLock<PrometheusHandle> = OnceLock::new();

#[derive(Debug, Deserialize)]
pub struct MetricsQuery {
    token: Option<String>,
}

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
pub async fn metrics(
    headers: HeaderMap,
    Query(query): Query<MetricsQuery>,
) -> Result<Response, ApiError> {
    if !metrics_authorized(&headers, query.token.as_deref()) {
        return Err(ApiError::unauthorized("Unauthorized"));
    }

    let body = PROMETHEUS
        .get()
        .map(PrometheusHandle::render)
        .unwrap_or_default();

    Ok((StatusCode::OK, body).into_response())
}

fn metrics_authorized(headers: &HeaderMap, query_token: Option<&str>) -> bool {
    let expected = match std::env::var("METRICS_TOKEN") {
        Ok(token) if !token.is_empty() => token,
        _ => return false,
    };

    if let Some(auth) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    {
        if let Some(bearer) = auth.strip_prefix("Bearer ") {
            if constant_time_eq(bearer, &expected) {
                return true;
            }
        }
    }

    query_token.is_some_and(|token| constant_time_eq(token, &expected))
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    left.as_bytes().ct_eq(right.as_bytes()).into()
}
