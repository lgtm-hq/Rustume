//! Session cookie and API key authentication extractors for cloud routes.

use axum::{
    extract::{FromRequestParts, Request, State},
    http::{request::Parts, HeaderMap},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use tracing::error;
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::auth::api_key::{extract_token_from_headers, hash_token};
use crate::auth::session::SESSION_COOKIE;
use crate::db::User;
use crate::error::ApiError;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

/// API key identifier stored in request extensions when authenticated via key.
#[derive(Debug, Clone, Copy)]
pub struct ApiKeyId(pub Uuid);

/// Authenticated user extracted from a session cookie or API key.
pub struct AuthUser(pub User);

impl AuthUser {
    /// Build an authenticated user for tests and direct handler calls.
    pub fn session(user: User) -> Self {
        Self(user)
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let cloud = state.cloud()?;

        if let Some(user) = user_from_session_cookie(parts, state, cloud).await? {
            return Ok(AuthUser(user));
        }

        if let Some((user, key_id)) = user_from_api_key(state, &cloud.db, &parts.headers).await? {
            parts.extensions.insert(ApiKeyId(key_id));
            return Ok(AuthUser(user));
        }

        Err(unauthorized("Not authenticated"))
    }
}

/// Authenticated user extracted from a session cookie only.
///
/// Rejects API-key-authenticated requests so keys cannot manage themselves or
/// access destructive account routes.
pub struct SessionAuthUser(pub User);

impl FromRequestParts<AppState> for SessionAuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let cloud = state.cloud()?;
        let user = user_from_session_cookie(parts, state, cloud)
            .await?
            .ok_or_else(|| unauthorized("Not authenticated"))?;
        Ok(SessionAuthUser(user))
    }
}

async fn user_from_session_cookie(
    parts: &mut Parts,
    state: &AppState,
    cloud: &crate::cloud::CloudState,
) -> Result<Option<User>, ApiError> {
    let jar = CookieJar::from_request_parts(parts, state)
        .await
        .map_err(|_| ApiError::internal("failed to read cookies"))?;

    let Some(token) = jar
        .get(SESSION_COOKIE)
        .map(|cookie| cookie.value().to_string())
    else {
        return Ok(None);
    };

    let user = cloud.sessions.user_for_token(&token).await.map_err(|err| {
        error!("session lookup failed: {err}");
        ApiError::internal("internal server error")
    })?;

    match user {
        Some(user) => Ok(Some(user)),
        None => Ok(None),
    }
}

async fn user_from_api_key(
    state: &AppState,
    pool: &sqlx::PgPool,
    headers: &HeaderMap,
) -> Result<Option<(User, Uuid)>, ApiError> {
    let Some(token) = extract_token_from_headers(headers) else {
        return Ok(None);
    };

    let key_hash = hash_token(&token);
    let row = sqlx::query_as::<_, ApiKeyUserRow>(
        r#"
        SELECT
            api_keys.id AS key_id,
            users.id,
            users.workos_id,
            users.plan,
            users.paddle_customer_id,
            users.email,
            users.first_name,
            users.last_name,
            users.created_at,
            users.updated_at
        FROM api_keys
        INNER JOIN users ON users.id = api_keys.user_id
        WHERE api_keys.key_hash = $1
          AND api_keys.revoked_at IS NULL
        "#,
    )
    .bind(&key_hash)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!("api key lookup failed: {err}");
        ApiError::internal("internal server error")
    })?;

    let Some(row) = row else {
        record_api_key_auth_failure(state, headers, "invalid_or_revoked").await;
        return Err(unauthorized("Invalid or revoked API key"));
    };

    let key_id = row.key_id;
    let user = User {
        id: row.id,
        workos_id: row.workos_id,
        plan: row.plan,
        paddle_customer_id: row.paddle_customer_id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    touch_api_key_last_used(pool.clone(), key_id);

    Ok(Some((user, key_id)))
}

#[derive(Debug, sqlx::FromRow)]
struct ApiKeyUserRow {
    key_id: Uuid,
    id: Uuid,
    workos_id: String,
    plan: String,
    paddle_customer_id: Option<String>,
    email: Option<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

fn touch_api_key_last_used(pool: sqlx::PgPool, key_id: Uuid) {
    tokio::spawn(async move {
        let result = sqlx::query(
            r#"
            UPDATE api_keys
            SET last_used_at = now()
            WHERE id = $1
              AND revoked_at IS NULL
            "#,
        )
        .bind(key_id)
        .execute(&pool)
        .await;

        if let Err(err) = result {
            error!("api key last_used_at update failed: {err}");
        }
    });
}

async fn record_api_key_auth_failure(state: &AppState, headers: &HeaderMap, reason: &str) {
    let Ok(cloud) = state.cloud() else {
        return;
    };

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "api_key.auth_failure",
            actor_user_id: None,
            resource_type: Some("api_key"),
            resource_id: None,
            metadata: serde_json::json!({ "reason": reason }),
            ip_address: trusted_client_ip(headers, net::trusted_proxy_enabled()).as_deref(),
        },
    )
    .await;
}

fn unauthorized(message: &str) -> ApiError {
    ApiError::unauthorized(message)
}

/// Require a session or API key on billable routes when hosted require-auth mode is enabled.
pub async fn require_auth_when_enabled(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if !state.require_auth {
        return Ok(next.run(request).await);
    }

    let (mut parts, body) = request.into_parts();
    AuthUser::from_request_parts(&mut parts, &state).await?;
    Ok(next.run(Request::from_parts(parts, body)).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::api_key::{generate_token, TOKEN_LEN, TOKEN_PREFIX};

    #[test]
    fn session_auth_user_helper_wraps_user() {
        let user = User {
            id: Uuid::nil(),
            workos_id: "user_01".to_string(),
            plan: "free".to_string(),
            paddle_customer_id: None,
            email: None,
            first_name: None,
            last_name: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let auth = AuthUser::session(user.clone());
        assert_eq!(auth.0.id, user.id);
    }

    #[test]
    fn generated_tokens_match_expected_prefix_and_length() {
        let token = generate_token();
        assert!(token.starts_with(TOKEN_PREFIX));
        assert_eq!(token.len(), TOKEN_LEN);
    }
}
