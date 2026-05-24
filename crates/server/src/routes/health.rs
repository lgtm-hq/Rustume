use axum::{
    extract::State,
    response::{IntoResponse, Response},
};
use tracing::error;

use crate::error::ApiError;
use crate::state::AppState;

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
        sqlx::query("SELECT 1")
            .execute(&cloud.db)
            .await
            .map_err(|err| {
                error!("health check database ping failed: {err}");
                ApiError::internal("health check failed").into_response()
            })?;
    }
    Ok("ok")
}
