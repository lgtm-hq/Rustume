//! Account lifecycle routes for Rustume Cloud.

use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use tracing::{error, info, warn};

use crate::audit::{record_event, record_event_required, AuditEvent};
use crate::auth::session::SESSION_COOKIE;
use crate::auth::username::{normalize_username, validate_username};
use crate::db::{
    DeleteAccountRequest, DeleteAccountResponse, UpdateAccountRequest, UpdateAccountResponse,
};
use crate::email::log_send_failure;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

const DELETE_CONFIRMATION: &str = "DELETE";

/// Update the authenticated user's display username.
#[utoipa::path(
    patch,
    path = "/api/account",
    tag = "Account",
    request_body = UpdateAccountRequest,
    responses(
        (status = 200, description = "Username updated", body = UpdateAccountResponse),
        (status = 400, description = "Invalid username", body = ApiError),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Account no longer exists", body = ApiError),
        (status = 409, description = "Username already taken", body = ApiError),
        (status = 500, description = "Update failed", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn update_account(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<UpdateAccountRequest>,
) -> Result<Json<UpdateAccountResponse>, ApiError> {
    let cloud = state.cloud()?;
    let username = normalize_username(&body.username);

    if let Err(message) = validate_username(&username) {
        return Err(ApiError::new(message));
    }

    if username == user.username {
        return Ok(Json(UpdateAccountResponse { username }));
    }

    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());
    let ip = net::audit_ip(ip_address.as_deref());

    let mut tx = cloud.db.begin().await.map_err(internal_db_error)?;

    let updated = sqlx::query_scalar::<_, String>(
        r#"
        UPDATE users
        SET username = $1, updated_at = now()
        WHERE id = $2
        RETURNING username
        "#,
    )
    .bind(&username)
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_account_db_error)?;

    let username = updated.ok_or_else(|| ApiError::not_found("account not found"))?;

    record_event_required(
        &mut *tx,
        AuditEvent {
            event_type: "account.username_changed",
            actor_user_id: Some(user.id),
            resource_type: Some("account"),
            resource_id: Some(user.id),
            metadata: serde_json::json!({
                "previous_username": user.username,
                "new_username": username,
            }),
            ip_address: ip,
        },
    )
    .await
    .map_err(|err| {
        error!("audit log insert failed: {err}");
        ApiError::internal("failed to update username")
    })?;

    tx.commit().await.map_err(internal_db_error)?;

    Ok(Json(UpdateAccountResponse { username }))
}

/// Permanently delete the authenticated user's account and all associated data.
#[utoipa::path(
    delete,
    path = "/api/account",
    tag = "Account",
    request_body = DeleteAccountRequest,
    responses(
        (status = 200, description = "Account deleted", body = DeleteAccountResponse),
        (status = 400, description = "Invalid confirmation", body = ApiError),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 500, description = "Deletion failed", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn delete_account(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(body): Json<DeleteAccountRequest>,
) -> Result<Response, ApiError> {
    if !is_valid_delete_confirmation(&body.confirmation) {
        return Err(ApiError::new("Type DELETE to confirm account deletion"));
    }

    let cloud = state.cloud()?;
    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());
    let ip = net::audit_ip(ip_address.as_deref());

    let resume_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM resumes
        WHERE user_id = $1
        "#,
    )
    .bind(user.id)
    .fetch_one(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    let email = user.email.clone();
    let workos_id = user.workos_id.clone();

    if user.paddle_customer_id.is_some() {
        info!(
            user_id = %user.id,
            "paddle subscription cancellation deferred until billing API is integrated"
        );
    }

    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user.id)
        .execute(&cloud.db)
        .await
        .map_err(|err| {
            error!("user deletion failed: {err}");
            ApiError::internal("failed to delete account")
        })?;

    if let Some(cookie) = jar.get(SESSION_COOKIE) {
        if let Err(err) = cloud.sessions.delete(cookie.value()).await {
            warn!(
                user_id = %user.id,
                error = %err,
                "session cleanup failed after account deletion; user row already removed"
            );
        }
    }

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "account.delete",
            actor_user_id: Some(user.id),
            resource_type: Some("account"),
            resource_id: Some(user.id),
            metadata: serde_json::json!({
                "resume_count": resume_count,
                "had_paddle_customer": user.paddle_customer_id.is_some(),
            }),
            ip_address: ip,
        },
    )
    .await;

    if let Err(err) = cloud.workos.delete_user(&workos_id).await {
        warn!(
            user_id = %user.id,
            workos_id = %workos_id,
            error = %err,
            "WorkOS user deletion failed after local data erasure"
        );
    }

    if let (Some(service), Some(recipient)) = (cloud.email.as_ref(), email.as_deref()) {
        if let Err(err) = service.send_deletion_confirmation(recipient).await {
            log_send_failure("deletion_confirmation", recipient, &err);
        }
    }

    let clear = cloud.sessions.clear_cookie();
    let payload = DeleteAccountResponse {
        deleted: true,
        message: "Account and all data permanently deleted.".to_string(),
    };
    let mut response = (StatusCode::OK, Json(payload)).into_response();
    append_set_cookie(&mut response, &clear)?;
    Ok(response)
}

fn is_valid_delete_confirmation(confirmation: &str) -> bool {
    confirmation == DELETE_CONFIRMATION
}

fn internal_db_error(err: impl std::fmt::Display) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
}

fn map_account_db_error(err: sqlx::Error) -> ApiError {
    if let sqlx::Error::Database(db_err) = &err {
        if db_err.code().as_deref() == Some("23505") {
            return ApiError::conflict("username already taken");
        }
    }
    internal_db_error(err)
}

fn append_set_cookie(
    response: &mut Response,
    cookie: &axum_extra::extract::cookie::Cookie<'static>,
) -> Result<(), ApiError> {
    let header_value = cookie
        .to_string()
        .parse::<header::HeaderValue>()
        .map_err(|err| ApiError::internal(format!("invalid cookie header: {err}")))?;
    response
        .headers_mut()
        .append(header::SET_COOKIE, header_value);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ApiErrorKind;
    use crate::state::AppState;
    use std::sync::Arc;
    use uuid::Uuid;

    #[test]
    fn delete_confirmation_requires_exact_match() {
        assert!(is_valid_delete_confirmation("DELETE"));
        assert!(!is_valid_delete_confirmation("delete"));
        assert!(!is_valid_delete_confirmation("DELETE "));
        assert!(!is_valid_delete_confirmation(""));
    }

    #[test]
    fn non_database_errors_map_to_internal_error() {
        // sqlx exposes no public constructor for database errors, so only the
        // fallback branch is unit-testable; the 23505 -> 409 mapping is covered
        // by `update_account_persists_username_and_audits_when_database_available`,
        // which fails (rather than skips) in CI when the test database is absent.
        let err = map_account_db_error(sqlx::Error::RowNotFound);
        assert!(matches!(err.kind, ApiErrorKind::InternalError));
    }

    fn test_user(username: &str) -> crate::db::User {
        let id = Uuid::new_v4();
        crate::db::User {
            id,
            workos_id: format!("workos_account_{id}"),
            plan: "free".to_string(),
            paddle_customer_id: None,
            email: Some(format!("account-{id}@example.com")),
            username: username.to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn app_state(pool: sqlx::PgPool) -> AppState {
        use crate::auth::{session::SessionService, workos::WorkOsClient};
        use crate::cloud::CloudState;

        AppState::with_require_auth(
            Arc::new(crate::routes::static_dir()),
            Some(Arc::new(CloudState {
                db: pool.clone(),
                workos: WorkOsClient::new("client_test".into(), "api_key_test".into()),
                sessions: SessionService::new(
                    pool,
                    "test-session-secret-at-least-32-chars".into(),
                    false,
                ),
                workos_redirect_uri: "http://localhost/auth/callback".into(),
                email: None,
            })),
            true,
        )
    }

    #[tokio::test]
    async fn update_account_rejects_invalid_usernames_before_touching_the_database() {
        let state = app_state(crate::cloud::test_cloud_state().db.clone());
        let user = test_user("swift-otter-4821");

        for (input, message) in [
            (
                "Bad_Name",
                "Username may only contain lowercase letters, digits, and hyphens",
            ),
            ("ab", "Username must be 3-32 characters"),
            ("", "Username must be 3-32 characters"),
            ("   ", "Username must be 3-32 characters"),
            (
                "-swift",
                "Username cannot start, end, or contain consecutive hyphens",
            ),
            ("admin", "Username is reserved"),
        ] {
            let err = update_account(
                AuthUser(user.clone()),
                State(state.clone()),
                HeaderMap::new(),
                Json(UpdateAccountRequest {
                    username: input.to_string(),
                }),
            )
            .await
            .expect_err(input);
            assert!(matches!(err.kind, ApiErrorKind::BadRequest), "{input}");
            assert_eq!(err.error, message, "{input}");
        }
    }

    #[tokio::test]
    async fn update_account_is_a_no_op_for_the_current_username() {
        // The lazy pool never connects: reaching the database here would fail.
        let state = app_state(crate::cloud::test_cloud_state().db.clone());
        let user = test_user("swift-otter-4821");

        let Json(response) = update_account(
            AuthUser(user),
            State(state),
            HeaderMap::new(),
            Json(UpdateAccountRequest {
                username: "  Swift-Otter-4821 ".to_string(),
            }),
        )
        .await
        .expect("same username is accepted");
        assert_eq!(response.username, "swift-otter-4821");
    }

    fn database_url_for_tests() -> Option<String> {
        let Some(url) = std::env::var("TEST_DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())
        else {
            skip_or_fail_without_test_db();
            return None;
        };
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
            skip_or_fail_without_test_db();
            None
        }
    }

    /// Locally the DB-backed tests are optional; in CI (which always provisions
    /// Postgres) a missing or misnamed database must fail rather than pass with
    /// zero assertions.
    fn skip_or_fail_without_test_db() {
        let message = "account integration tests need TEST_DATABASE_URL naming a *_test database";
        if std::env::var("CI").is_ok() {
            panic!("{message}");
        }
        eprintln!("SKIP {message}");
    }

    async fn insert_user(pool: &sqlx::PgPool, user: &crate::db::User) {
        sqlx::query("INSERT INTO users (id, workos_id, email, username) VALUES ($1, $2, $3, $4)")
            .bind(user.id)
            .bind(&user.workos_id)
            .bind(&user.email)
            .bind(&user.username)
            .execute(pool)
            .await
            .expect("insert user");
    }

    async fn cleanup_user(pool: &sqlx::PgPool, user_id: Uuid) {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(user_id)
            .execute(pool)
            .await
            .expect("cleanup user");
    }

    #[tokio::test]
    async fn update_account_persists_username_and_audits_when_database_available() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(2)
            .connect(&database_url)
            .await
            .expect("connect");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("migrate");

        let suffix = &Uuid::new_v4().simple().to_string()[..8];
        let alice = test_user(&format!("alice-{suffix}"));
        let bob = test_user(&format!("bob-{suffix}"));
        insert_user(&pool, &alice).await;
        insert_user(&pool, &bob).await;
        let state = app_state(pool.clone());

        // Success: row updated and an audit event recorded in the same transaction.
        let new_name = format!("ada-{suffix}");
        let Json(response) = update_account(
            AuthUser(alice.clone()),
            State(state.clone()),
            HeaderMap::new(),
            Json(UpdateAccountRequest {
                username: new_name.clone(),
            }),
        )
        .await
        .expect("rename");
        assert_eq!(response.username, new_name);

        let stored: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
            .bind(alice.id)
            .fetch_one(&pool)
            .await
            .expect("stored username");
        assert_eq!(stored, new_name);

        let audit: serde_json::Value = sqlx::query_scalar(
            r#"
            SELECT metadata FROM audit_events
            WHERE actor_user_id = $1 AND event_type = 'account.username_changed'
            ORDER BY created_at DESC LIMIT 1
            "#,
        )
        .bind(alice.id)
        .fetch_one(&pool)
        .await
        .expect("audit row");
        assert_eq!(audit["previous_username"], alice.username);
        assert_eq!(audit["new_username"], new_name);

        // Conflict: taking another user's handle maps the unique violation to 409
        // and leaves both rows untouched.
        let err = update_account(
            AuthUser(bob.clone()),
            State(state),
            HeaderMap::new(),
            Json(UpdateAccountRequest {
                username: new_name.clone(),
            }),
        )
        .await
        .expect_err("duplicate username must conflict");
        assert!(matches!(err.kind, ApiErrorKind::Conflict), "{err:?}");
        assert_eq!(err.error, "username already taken");

        let bob_stored: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
            .bind(bob.id)
            .fetch_one(&pool)
            .await
            .expect("bob username");
        assert_eq!(bob_stored, bob.username);

        cleanup_user(&pool, alice.id).await;
        cleanup_user(&pool, bob.id).await;
    }
}
