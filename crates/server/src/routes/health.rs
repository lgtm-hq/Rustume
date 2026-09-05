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
pub async fn health(State(state): State<AppState>) -> Response {
    if let Some(cloud) = &state.cloud {
        match tokio::time::timeout(
            HEALTH_DB_TIMEOUT,
            sqlx::query("SELECT 1").execute(&cloud.db),
        )
        .await
        {
            Ok(Ok(_)) => {}
            Ok(Err(err)) => {
                error!("health check database ping failed: {err}");
                return ApiError::internal("health check failed").into_response();
            }
            Err(_) => {
                error!("health check database ping timed out");
                return ApiError::internal("health check failed").into_response();
            }
        }
    }
    "ok".into_response()
}
