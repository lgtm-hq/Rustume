use axum::{
    extract::State,
    response::{IntoResponse, Response},
};
use std::time::Duration;
use tracing::error;

use crate::error::ApiError;
use crate::state::AppState;

const HEALTH_DB_TIMEOUT: Duration = Duration::from_secs(3);

/// Health check
///
/// Returns "ok" if the server is running (and the database is reachable in cloud mode).
#[utoipa::path(
    get,
    path = "/health",
    tag = "Health",
    responses(
        (status = 200, description = "Server is healthy", body = String, example = "ok")
    )
)]
pub async fn health(State(state): State<AppState>) -> Result<&'static str, Response> {
    if let Some(cloud) = &state.cloud {
        tokio::time::timeout(
            HEALTH_DB_TIMEOUT,
            sqlx::query("SELECT 1").execute(&cloud.db),
        )
        .await
        .map_err(|_| {
            error!("health check database ping timed out");
            ApiError::internal("health check failed").into_response()
        })?
        .map_err(|err| {
            error!("health check database ping failed: {err}");
            ApiError::internal("health check failed").into_response()
        })?;
    }
    Ok("ok")
}
