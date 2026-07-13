//! Account lifecycle routes for Rustume Cloud.

use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::extract::cookie::CookieJar;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::{stream, Stream, TryStreamExt};
use serde::Serialize;
use std::io;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::audit::{record_event, record_event_required, AuditEvent};
use crate::auth::session::SESSION_COOKIE;
use crate::db::{
    AccountDataExport, AccountExportProfile, DeleteAccountRequest, DeleteAccountResponse,
};
use crate::email::log_send_failure;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;

const DELETE_CONFIRMATION: &str = "DELETE";
const EXPORT_STREAM_CHUNK_BYTES: usize = 64 * 1024;
const EXPORT_STREAM_CHANNEL_CAPACITY: usize = 2;

/// Resume fields required for account data export.
#[derive(Debug, sqlx::FromRow)]
struct ExportResumeRow {
    id: Uuid,
    title: String,
    data_json: String,
}

/// Export all account data for GDPR data portability.
#[utoipa::path(
    get,
    path = "/api/account/export",
    tag = "Account",
    responses(
        (status = 200, description = "Account data export", body = AccountDataExport),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 500, description = "Export failed", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn export_account(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let ip_address = trusted_client_ip(&headers, net::trusted_proxy_enabled());
    let ip = ip_address.as_deref();

    let mut tx = cloud.db.begin().await.map_err(internal_db_error)?;
    let resume_count = account_resume_count(&mut *tx, user.id).await?;

    record_event_required(
        &cloud.db,
        AuditEvent {
            event_type: "account.export",
            actor_user_id: Some(user.id),
            resource_type: Some("account"),
            resource_id: Some(user.id),
            metadata: serde_json::json!({ "resume_count": resume_count }),
            ip_address: ip,
        },
    )
    .await?;

    let exported_at = Utc::now();
    let account = AccountExportProfile::from_user(&user);
    let prefix = build_export_prefix(exported_at, &account)?;
    let export_stream = stream_account_export(tx, user.id, prefix);

    let content_disposition =
        HeaderValue::from_static("attachment; filename=\"rustume-account-export.json\"");
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::CONTENT_DISPOSITION, content_disposition)
        .body(Body::from_stream(export_stream))
        .map_err(|err| ApiError::internal(format!("failed to build export response: {err}")))
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
    let ip = ip_address.as_deref();

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
    append_set_cookie(&mut response, clear)?;
    Ok(response)
}

fn is_valid_delete_confirmation(confirmation: &str) -> bool {
    confirmation == DELETE_CONFIRMATION
}

async fn account_resume_count<'e, E>(db: E, user_id: Uuid) -> Result<usize, ApiError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let resume_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM resumes
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(internal_db_error)?;

    Ok(resume_count as usize)
}

fn build_export_prefix(
    exported_at: DateTime<Utc>,
    account: &AccountExportProfile,
) -> Result<Vec<u8>, ApiError> {
    let mut body = Vec::new();
    body.push(b'{');
    append_json_field(&mut body, "exported_at", &exported_at, true)?;
    append_json_field(&mut body, "account", account, false)?;
    body.extend_from_slice(br#","resumes":["#);
    Ok(body)
}

fn stream_account_export(
    db_tx: sqlx::Transaction<'static, sqlx::Postgres>,
    user_id: Uuid,
    prefix: Vec<u8>,
) -> impl Stream<Item = Result<Bytes, io::Error>> + Send + 'static {
    let (chunk_tx, chunk_rx) =
        mpsc::channel::<Result<Bytes, io::Error>>(EXPORT_STREAM_CHANNEL_CAPACITY);

    tokio::spawn(async move {
        let mut db_tx = db_tx;

        if chunk_tx.send(Ok(Bytes::from(prefix))).await.is_err() {
            return;
        }

        let mut rows = sqlx::query_as::<_, ExportResumeRow>(
            r#"
            SELECT id, title, data::text AS data_json
            FROM resumes
            WHERE user_id = $1
            ORDER BY updated_at DESC
            "#,
        )
        .bind(user_id)
        .fetch(&mut *db_tx);

        let mut first_resume = true;
        while let Some(row) = match rows.try_next().await {
            Ok(row) => row,
            Err(err) => {
                let _ = chunk_tx
                    .send(Err(io::Error::other(internal_db_error(err).error)))
                    .await;
                return;
            }
        } {
            if let Err(err) = stream_resume_row(&chunk_tx, row, &mut first_resume).await {
                let _ = chunk_tx.send(Err(io::Error::other(err.error))).await;
                return;
            }
        }

        drop(rows);
        let _ = chunk_tx.send(Ok(Bytes::from_static(b"]}"))).await;
        if let Err(err) = db_tx.commit().await {
            error!("account export transaction commit failed: {err}");
        }
    });

    stream::unfold(chunk_rx, |mut chunk_rx| async move {
        chunk_rx.recv().await.map(|item| (item, chunk_rx))
    })
}

async fn stream_resume_row(
    chunk_tx: &mpsc::Sender<Result<Bytes, io::Error>>,
    row: ExportResumeRow,
    first: &mut bool,
) -> Result<(), ApiError> {
    let title_json = serde_json::to_string(&row.title).map_err(|err| {
        error!("account export title serialization failed: {err}");
        ApiError::internal("failed to export account data")
    })?;
    let prefix = if *first {
        *first = false;
        String::new()
    } else {
        ",".to_string()
    };
    let header = format!(
        r#"{prefix}{{"id":"{}","title":{},"data":"#,
        row.id, title_json
    );
    if chunk_tx.send(Ok(Bytes::from(header))).await.is_err() {
        return Ok(());
    }

    for chunk in row.data_json.as_bytes().chunks(EXPORT_STREAM_CHUNK_BYTES) {
        if chunk_tx
            .send(Ok(Bytes::copy_from_slice(chunk)))
            .await
            .is_err()
        {
            return Ok(());
        }
    }

    if chunk_tx.send(Ok(Bytes::from_static(b"}"))).await.is_err() {
        return Ok(());
    }

    Ok(())
}

fn append_json_field(
    body: &mut Vec<u8>,
    key: &str,
    value: &impl Serialize,
    first: bool,
) -> Result<(), ApiError> {
    if !first {
        body.push(b',');
    }
    body.extend_from_slice(b"\"");
    body.extend_from_slice(key.as_bytes());
    body.extend_from_slice(b"\":");
    serde_json::to_writer(body, value).map_err(|err| {
        error!("account export serialization failed: {err}");
        ApiError::internal("failed to export account data")
    })
}

fn internal_db_error(err: sqlx::Error) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
}

fn append_set_cookie(
    response: &mut Response,
    cookie: axum_extra::extract::cookie::Cookie<'static>,
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
    use crate::auth::{session::SessionService, workos::WorkOsClient};
    use crate::cloud::CloudState;
    use crate::email::EmailService;
    use crate::error::ApiErrorKind;
    use crate::routes::export::export_resumes_json;
    use crate::state::AppState;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use chrono::{Duration, Utc};
    use sqlx::postgres::PgPoolOptions;
    use std::sync::Arc;
    use tower::ServiceExt;

    #[test]
    fn delete_confirmation_requires_exact_match() {
        assert!(is_valid_delete_confirmation("DELETE"));
        assert!(!is_valid_delete_confirmation("delete"));
        assert!(!is_valid_delete_confirmation("DELETE "));
        assert!(!is_valid_delete_confirmation(""));
    }

    fn looks_like_test_database_url(url: &str) -> bool {
        let db_name = url
            .split(['?', '#'])
            .next()
            .unwrap_or(url)
            .rsplit('/')
            .next()
            .unwrap_or("");
        db_name.contains("_test")
    }

    fn database_url_for_tests() -> Option<String> {
        let url = std::env::var("TEST_DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())
            .or_else(|| {
                std::env::var("DATABASE_URL")
                    .ok()
                    .map(|url| url.trim().to_owned())
                    .filter(|url| !url.is_empty())
            })?;

        if looks_like_test_database_url(&url) {
            Some(url)
        } else {
            eprintln!(
                "SKIP account export integration tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database whose name contains _test"
            );
            None
        }
    }

    async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(database_url)
            .await
            .expect("connect to test database for account export integration tests");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations for account export integration tests");
        pool
    }

    async fn seed_user_with_resumes(pool: &sqlx::PgPool, count: i64) -> crate::db::User {
        let user_id = Uuid::new_v4();
        let workos_id = format!("workos_account_export_{user_id}");

        sqlx::query(
            r#"
            INSERT INTO users (id, workos_id, email, first_name, last_name, plan)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(user_id)
        .bind(&workos_id)
        .bind(format!("account-export-{user_id}@example.com"))
        .bind("Ada")
        .bind("Lovelace")
        .bind("free")
        .execute(pool)
        .await
        .expect("insert user");

        for index in 0..count {
            sqlx::query("INSERT INTO resumes (user_id, title, data) VALUES ($1, $2, $3)")
                .bind(user_id)
                .bind(format!("Resume {index}"))
                .bind(serde_json::json!({ "index": index }))
                .execute(pool)
                .await
                .expect("insert resume");
        }

        sqlx::query_as::<_, crate::db::User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .expect("fetch user")
    }

    async fn seed_expired_subscription(pool: &sqlx::PgPool, user_id: Uuid) {
        let expired_at = Utc::now() - Duration::days(30);
        let subscription_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO subscriptions (
                user_id,
                paddle_subscription_id,
                paddle_price_id,
                plan,
                status,
                current_period_end
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(user_id)
        .bind(format!("sub_expired_{subscription_id}"))
        .bind("pri_expired_test")
        .bind("pro")
        .bind("canceled")
        .bind(expired_at)
        .execute(pool)
        .await
        .expect("insert expired subscription");
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
                email: Some(EmailService::new(
                    "re_test".into(),
                    "noreply@rustume.com".into(),
                )),
            })),
            false,
        )
    }

    async fn read_export_payload(response: Response) -> serde_json::Value {
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read account export body");
        serde_json::from_slice(&body).expect("parse account export JSON")
    }

    #[tokio::test]
    async fn export_account_returns_account_fields_and_resumes() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 2).await;
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("expected account export to succeed");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "attachment; filename=\"rustume-account-export.json\"",
        );

        let payload = read_export_payload(response).await;
        cleanup_user(&pool, user.id).await;
        assert_eq!(payload["account"]["id"], user.id.to_string());
        assert_eq!(
            payload["account"]["email"],
            user.email.as_deref().unwrap_or_default()
        );
        assert_eq!(payload["account"]["first_name"], "Ada");
        assert_eq!(payload["account"]["last_name"], "Lovelace");
        assert_eq!(payload["account"]["plan"], "free");
        assert_eq!(payload["resumes"].as_array().map(Vec::len), Some(2));
        let titles: Vec<&str> = payload["resumes"]
            .as_array()
            .expect("resumes array")
            .iter()
            .map(|resume| resume["title"].as_str().expect("resume title"))
            .collect();
        assert!(titles.contains(&"Resume 0"));
        assert!(titles.contains(&"Resume 1"));
    }

    #[tokio::test]
    async fn export_account_writes_audit_event() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 1).await;
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("expected account export to succeed");
        let _ = read_export_payload(response).await;

        let audit_row =
            sqlx::query_as::<_, (String, Option<Uuid>, Option<String>, serde_json::Value)>(
                r#"
            SELECT event_type, actor_user_id, resource_type, metadata
            FROM audit_events
            WHERE actor_user_id = $1 AND event_type = 'account.export'
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            )
            .bind(user.id)
            .fetch_one(&pool)
            .await
            .expect("fetch account export audit row");
        cleanup_user(&pool, user.id).await;

        assert_eq!(audit_row.0, "account.export");
        assert_eq!(audit_row.1, Some(user.id));
        assert_eq!(audit_row.2.as_deref(), Some("account"));
        assert_eq!(audit_row.3["resume_count"], 1);
    }

    #[tokio::test]
    async fn export_account_succeeds_without_active_subscription() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 1).await;
        seed_expired_subscription(&pool, user.id).await;
        let state = test_app_state(pool.clone());

        let account_result = export_account(
            AuthUser(user.clone()),
            State(state.clone()),
            HeaderMap::new(),
        )
        .await;
        let resume_result = export_resumes_json(AuthUser(user.clone()), State(state)).await;

        let account_response =
            account_result.expect("account export should succeed without active subscription");
        let _ = read_export_payload(account_response).await;
        cleanup_user(&pool, user.id).await;

        assert!(matches!(
            resume_result,
            Err(err) if matches!(err.kind, ApiErrorKind::Forbidden)
        ));
    }

    #[tokio::test]
    async fn export_account_includes_all_resumes_above_bulk_export_cap() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 51).await;
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("account export should include every resume for portability");

        assert_eq!(response.status(), StatusCode::OK);
        let payload = read_export_payload(response).await;
        cleanup_user(&pool, user.id).await;
        assert_eq!(payload["resumes"].as_array().map(Vec::len), Some(51));
    }

    #[tokio::test]
    async fn export_account_unauthenticated_returns_401() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let state = test_app_state(pool);
        let app = crate::create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/account/export")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
