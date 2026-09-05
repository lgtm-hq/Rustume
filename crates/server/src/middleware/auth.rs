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
use crate::auth::api_key::{extract_token_from_headers, find_active_key, hash_token};
use crate::auth::session::SESSION_COOKIE;
use crate::db::User;
use crate::error::ApiError;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

/// Authenticated user extracted from a session cookie or API key.
#[derive(Debug)]
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

        if let Some(user) = user_from_api_key(state, &cloud.db, &parts.headers).await? {
            return Ok(AuthUser(user));
        }

        Err(unauthorized("Not authenticated"))
    }
}

/// Authenticated user extracted from a session cookie only.
///
/// Rejects API-key-authenticated requests so keys cannot manage themselves or
/// access destructive account routes.
#[derive(Debug)]
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
) -> Result<Option<User>, ApiError> {
    let Some(token) = extract_token_from_headers(headers) else {
        return Ok(None);
    };

    let key_hash = hash_token(&token);
    let key = find_active_key(pool, &key_hash).await.map_err(|err| {
        error!("api key lookup failed: {err}");
        ApiError::internal("internal server error")
    })?;

    let Some(key) = key else {
        record_api_key_auth_failure(state, headers, "invalid_or_revoked").await;
        return Err(unauthorized("Invalid or revoked API key"));
    };

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(key.user_id)
        .fetch_optional(pool)
        .await
        .map_err(|err| {
            error!("api key owner lookup failed: {err}");
            ApiError::internal("internal server error")
        })?;

    let Some(user) = user else {
        // Owner row gone but key row still present (should be prevented by the
        // ON DELETE CASCADE); treat as revoked rather than 500.
        record_api_key_auth_failure(state, headers, "owner_missing").await;
        return Err(unauthorized("Invalid or revoked API key"));
    };

    touch_api_key_last_used(pool.clone(), key.key_id);

    Ok(Some(user))
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

/// Require a session or API key on billable routes for every cloud deployment.
///
/// Self-hosted deployments have no accounts, so requests pass straight through.
/// The gate is keyed on cloud presence rather than a configuration flag: on a
/// billable hosted service, authentication must not be something a missing
/// environment variable can switch off.
pub async fn require_auth_when_enabled(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if state.cloud.is_none() {
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

    mod integration {
        //! Behavioural tests for API-key authentication. Skipped unless
        //! `TEST_DATABASE_URL` names a `*_test` database (same convention as the
        //! resume tests).

        use super::*;
        use crate::auth::api_key::{display_prefix, generate_token};
        use crate::auth::session::SessionService;
        use crate::auth::workos::WorkOsClient;
        use crate::cloud::CloudState;
        use crate::db::CreateApiKeyRequest;
        use crate::error::ApiErrorKind;
        use crate::routes::api_keys::{create_api_key, list_api_keys};
        use axum::body::Body;
        use axum::extract::State;
        use axum::http::{header, Request, StatusCode};
        use axum::Json;
        use sqlx::postgres::PgPoolOptions;
        use std::sync::Arc;

        fn database_url_for_tests() -> Option<String> {
            let url = std::env::var("TEST_DATABASE_URL")
                .ok()
                .or_else(|| std::env::var("DATABASE_URL").ok())
                .map(|url| url.trim().to_owned())
                .filter(|url| !url.is_empty())?;
            let db_name = url
                .split(['?', '#'])
                .next()
                .unwrap_or(&url)
                .rsplit('/')
                .next()
                .unwrap_or("");
            if db_name.contains("_test") {
                Some(url)
            } else {
                eprintln!(
                    "SKIP api key integration tests: TEST_DATABASE_URL must name a *_test database"
                );
                None
            }
        }

        async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
            let pool = PgPoolOptions::new()
                .max_connections(2)
                .connect(database_url)
                .await
                .expect("connect to test database");
            sqlx::migrate!("./src/db/migrations")
                .run(&pool)
                .await
                .expect("run migrations");
            pool
        }

        async fn seed_user(pool: &sqlx::PgPool) -> User {
            let user_id = Uuid::new_v4();
            sqlx::query("INSERT INTO users (id, workos_id) VALUES ($1, $2)")
                .bind(user_id)
                .bind(format!("workos_apikey_{user_id}"))
                .execute(pool)
                .await
                .expect("insert user");
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(user_id)
                .fetch_one(pool)
                .await
                .expect("fetch user")
        }

        /// Insert an active key row and return the plaintext token.
        async fn seed_key(pool: &sqlx::PgPool, user_id: Uuid, name: &str) -> (Uuid, String) {
            let token = generate_token();
            let (id,): (Uuid,) = sqlx::query_as(
                "INSERT INTO api_keys (user_id, name, key_hash, prefix) VALUES ($1, $2, $3, $4) RETURNING id",
            )
            .bind(user_id)
            .bind(name)
            .bind(hash_token(&token))
            .bind(display_prefix(&token).expect("prefix"))
            .fetch_one(pool)
            .await
            .expect("insert key");
            (id, token)
        }

        async fn cleanup_user(pool: &sqlx::PgPool, user_id: Uuid) {
            sqlx::query("DELETE FROM users WHERE id = $1")
                .bind(user_id)
                .execute(pool)
                .await
                .expect("cleanup user");
        }

        fn test_app_state(pool: sqlx::PgPool) -> AppState {
            let sessions_pool = pool.clone();
            AppState::with_require_auth(
                Arc::new(crate::routes::static_dir()),
                Some(Arc::new(CloudState {
                    db: pool,
                    workos: WorkOsClient::new("client_test".into(), "api_key_test".into()),
                    sessions: SessionService::new(
                        sessions_pool,
                        "test-session-secret-at-least-32-chars".into(),
                        false,
                    ),
                    workos_redirect_uri: "http://localhost/auth/callback".into(),
                    email: None,
                })),
                false,
            )
        }

        fn parts_with_header(name: header::HeaderName, value: String) -> Parts {
            let (parts, _) = Request::builder()
                .uri("/api/resumes")
                .header(name, value)
                .body(Body::empty())
                .unwrap()
                .into_parts();
            parts
        }

        #[tokio::test]
        async fn auth_user_accepts_bearer_and_x_api_key_and_rejects_revoked() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let user = seed_user(&pool).await;
            let (key_id, token) = seed_key(&pool, user.id, "CI").await;
            let state = test_app_state(pool.clone());

            let mut parts = parts_with_header(header::AUTHORIZATION, format!("Bearer {token}"));
            let AuthUser(via_bearer) = AuthUser::from_request_parts(&mut parts, &state)
                .await
                .expect("bearer key authenticates");
            assert_eq!(via_bearer.id, user.id);

            let mut parts =
                parts_with_header(header::HeaderName::from_static("x-api-key"), token.clone());
            let AuthUser(via_header) = AuthUser::from_request_parts(&mut parts, &state)
                .await
                .expect("x-api-key authenticates");
            assert_eq!(via_header.id, user.id);

            // Unknown token is rejected with 401, not 500.
            let mut parts = parts_with_header(
                header::AUTHORIZATION,
                format!("Bearer {}", generate_token()),
            );
            let err = AuthUser::from_request_parts(&mut parts, &state)
                .await
                .expect_err("unknown key is rejected");
            assert!(matches!(err.kind, ApiErrorKind::Unauthorized));

            // Revoked key stops working immediately.
            sqlx::query("UPDATE api_keys SET revoked_at = now() WHERE id = $1")
                .bind(key_id)
                .execute(&pool)
                .await
                .expect("revoke");
            let mut parts = parts_with_header(header::AUTHORIZATION, format!("Bearer {token}"));
            let err = AuthUser::from_request_parts(&mut parts, &state)
                .await
                .expect_err("revoked key is rejected");
            assert!(matches!(err.kind, ApiErrorKind::Unauthorized));

            cleanup_user(&pool, user.id).await;
        }

        #[tokio::test]
        async fn session_only_extractor_rejects_a_live_api_key() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let user = seed_user(&pool).await;
            let (_, token) = seed_key(&pool, user.id, "CI").await;
            let state = test_app_state(pool.clone());

            for (name, value) in [
                (header::AUTHORIZATION, format!("Bearer {token}")),
                (header::HeaderName::from_static("x-api-key"), token.clone()),
            ] {
                let mut parts = parts_with_header(name, value);
                let err = SessionAuthUser::from_request_parts(&mut parts, &state)
                    .await
                    .expect_err("keys cannot reach session-only routes");
                assert!(matches!(err.kind, ApiErrorKind::Unauthorized));
            }

            cleanup_user(&pool, user.id).await;
        }

        #[tokio::test]
        async fn create_api_key_enforces_active_key_cap_and_list_hides_revoked() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let user = seed_user(&pool).await;
            let state = test_app_state(pool.clone());

            for index in 0..crate::auth::api_key::MAX_ACTIVE_KEYS {
                let response = create_api_key(
                    SessionAuthUser(user.clone()),
                    State(state.clone()),
                    HeaderMap::new(),
                    Json(CreateApiKeyRequest {
                        name: format!("key {index}"),
                    }),
                )
                .await
                .expect("create within cap");
                assert_eq!(response.status(), StatusCode::CREATED);
            }

            let err = create_api_key(
                SessionAuthUser(user.clone()),
                State(state.clone()),
                HeaderMap::new(),
                Json(CreateApiKeyRequest {
                    name: "one too many".into(),
                }),
            )
            .await
            .expect_err("cap reached");
            assert!(matches!(err.kind, ApiErrorKind::Conflict));

            // Revoking one frees a slot and drops it from the list.
            let Json(keys) = list_api_keys(SessionAuthUser(user.clone()), State(state.clone()))
                .await
                .expect("list");
            assert_eq!(keys.len() as i64, crate::auth::api_key::MAX_ACTIVE_KEYS);
            sqlx::query("UPDATE api_keys SET revoked_at = now() WHERE id = $1")
                .bind(keys[0].id)
                .execute(&pool)
                .await
                .expect("revoke");
            let Json(keys_after) =
                list_api_keys(SessionAuthUser(user.clone()), State(state.clone()))
                    .await
                    .expect("list after revoke");
            assert_eq!(
                keys_after.len() as i64,
                crate::auth::api_key::MAX_ACTIVE_KEYS - 1
            );
            assert!(keys_after.iter().all(|key| key.id != keys[0].id));

            let response = create_api_key(
                SessionAuthUser(user.clone()),
                State(state),
                HeaderMap::new(),
                Json(CreateApiKeyRequest {
                    name: "replacement".into(),
                }),
            )
            .await
            .expect("create after revoke");
            assert_eq!(response.status(), StatusCode::CREATED);

            cleanup_user(&pool, user.id).await;
        }
    }
}
