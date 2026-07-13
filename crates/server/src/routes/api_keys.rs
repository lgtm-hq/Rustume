//! API key management routes for Rustume Cloud.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use tracing::error;
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::auth::api_key::{
    display_prefix, generate_token, hash_token, MAX_ACTIVE_KEYS, MAX_NAME_LEN, MIN_NAME_LEN,
};
use crate::db::{ApiKeySummary, CreateApiKeyRequest, CreateApiKeyResponse};
use crate::error::ApiError;
use crate::middleware::auth::SessionAuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

/// Create a new API key for the authenticated user.
#[utoipa::path(
    post,
    path = "/api/keys",
    tag = "API Keys",
    request_body = CreateApiKeyRequest,
    responses(
        (status = 201, description = "API key created", body = CreateApiKeyResponse),
        (status = 400, description = "Invalid request", body = ApiError),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 409, description = "Active key limit reached", body = ApiError),
        (status = 500, description = "Internal error", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn create_api_key(
    SessionAuthUser(user): SessionAuthUser,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Response, ApiError> {
    validate_key_name(&body.name)?;

    let cloud = state.cloud()?;

    let token = generate_token();
    let prefix = display_prefix(&token)
        .ok_or_else(|| ApiError::internal("failed to derive API key prefix"))?;
    let key_hash = hash_token(&token);

    let row = sqlx::query_as::<_, (Uuid,)>(
        r#"
        INSERT INTO api_keys (user_id, name, key_hash, prefix)
        SELECT $1, $2, $3, $4
        WHERE (
            SELECT COUNT(*)
            FROM api_keys
            WHERE user_id = $1
              AND revoked_at IS NULL
        ) < $5
        RETURNING id
        "#,
    )
    .bind(user.id)
    .bind(body.name.trim())
    .bind(key_hash)
    .bind(&prefix)
    .bind(MAX_ACTIVE_KEYS)
    .fetch_optional(&cloud.db)
    .await
    .map_err(|err| {
        error!("api key insert failed: {err}");
        ApiError::internal("failed to create API key")
    })?;

    let Some(row) = row else {
        return Err(ApiError::conflict(format!(
            "Maximum of {MAX_ACTIVE_KEYS} active API keys reached"
        )));
    };

    let key_id = row.0;
    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "api_key.created",
            actor_user_id: Some(user.id),
            resource_type: Some("api_key"),
            resource_id: Some(key_id),
            metadata: serde_json::json!({
                "name": body.name.trim(),
                "prefix": prefix,
            }),
            ip_address: ip_address.as_deref(),
        },
    )
    .await;

    Ok((
        StatusCode::CREATED,
        Json(CreateApiKeyResponse {
            id: key_id,
            name: body.name.trim().to_string(),
            prefix,
            key: token,
        }),
    )
        .into_response())
}

/// List active API keys for the authenticated user.
#[utoipa::path(
    get,
    path = "/api/keys",
    tag = "API Keys",
    responses(
        (status = 200, description = "API key list", body = Vec<ApiKeySummary>),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 500, description = "Internal error", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn list_api_keys(
    SessionAuthUser(user): SessionAuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ApiKeySummary>>, ApiError> {
    let cloud = state.cloud()?;

    let keys = sqlx::query_as::<_, ApiKeySummary>(
        r#"
        SELECT id, name, prefix, last_used_at, created_at
        FROM api_keys
        WHERE user_id = $1
          AND revoked_at IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    Ok(Json(keys))
}

/// Revoke an API key owned by the authenticated user.
#[utoipa::path(
    delete,
    path = "/api/keys/{id}",
    tag = "API Keys",
    params(("id" = String, Path, description = "API key ID")),
    responses(
        (status = 204, description = "API key revoked"),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "API key not found", body = ApiError),
        (status = 500, description = "Internal error", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn revoke_api_key(
    SessionAuthUser(user): SessionAuthUser,
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let cloud = state.cloud()?;

    let result = sqlx::query(
        r#"
        UPDATE api_keys
        SET revoked_at = now()
        WHERE id = $1
          AND user_id = $2
          AND revoked_at IS NULL
        "#,
    )
    .bind(id)
    .bind(user.id)
    .execute(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("API key not found"));
    }

    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "api_key.revoked",
            actor_user_id: Some(user.id),
            resource_type: Some("api_key"),
            resource_id: Some(id),
            metadata: serde_json::json!({}),
            ip_address: ip_address.as_deref(),
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

fn validate_key_name(name: &str) -> Result<(), ApiError> {
    let trimmed = name.trim();
    let char_count = trimmed.chars().count();

    if !(MIN_NAME_LEN..=MAX_NAME_LEN).contains(&char_count) {
        return Err(ApiError::new(format!(
            "API key name must be between {MIN_NAME_LEN} and {MAX_NAME_LEN} characters"
        )));
    }

    Ok(())
}

fn internal_db_error(err: sqlx::Error) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_key_name_rejects_empty_and_oversized_values() {
        assert!(validate_key_name("").is_err());
        assert!(validate_key_name("   ").is_err());
        assert!(validate_key_name(&"a".repeat(MAX_NAME_LEN + 1)).is_err());
        assert!(validate_key_name("CI deploy").is_ok());
    }
}
