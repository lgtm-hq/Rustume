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
use futures::{stream, FutureExt, Stream, TryStreamExt};
use serde::Serialize;
use std::io;
use std::panic::AssertUnwindSafe;
use tokio::sync::{mpsc, OwnedSemaphorePermit};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::audit::{record_event, record_event_required, AuditEvent};
use crate::auth::session::SESSION_COOKIE;
use crate::db::{
    AccountDataExport, AccountExportProfile, DeleteAccountRequest, DeleteAccountResponse,
    PolicyAcceptanceExport, SubscriptionExport,
};
use crate::email::log_send_failure;
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::middleware::rate_limit::RateLimitErrorBody;
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
    is_public: bool,
    public_slug: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    data_json: String,
}

/// Resume snapshot fields required for account data export.
#[derive(Debug, sqlx::FromRow)]
struct ExportSnapshotRow {
    resume_id: Uuid,
    version: i32,
    created_at: DateTime<Utc>,
    data_json: String,
}

/// Audit event fields required for account data export.
#[derive(Debug, sqlx::FromRow)]
struct ExportAuditRow {
    event_type: String,
    resource_type: Option<String>,
    resource_id: Option<Uuid>,
    ip_address: Option<String>,
    created_at: DateTime<Utc>,
    metadata_json: String,
}

/// Export all account data for GDPR data portability.
#[utoipa::path(
    get,
    path = "/api/account/export",
    tag = "Account",
    responses(
        (status = 200, description = "Account data export", body = AccountDataExport),
        (status = 401, description = "Not authenticated", body = ApiError),
        (
            status = 429,
            description = "Export quota exceeded (per user and shared per IP); retry after `retry_after` seconds",
            body = RateLimitErrorBody
        ),
        (status = 500, description = "Export failed", body = ApiError),
        (
            status = 503,
            description = "Too many exports streaming on this process; retry after `retry_after` seconds",
            body = RateLimitErrorBody
        ),
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

    // Each export pins one pool connection for as long as the client keeps
    // downloading. Cap how many can do that at once so a burst of slow
    // downloads cannot starve every other request of a connection.
    let Ok(permit) = state.export_permits.clone().try_acquire_owned() else {
        warn!(user_id = %user.id, "account export refused: concurrency ceiling reached");
        return Ok(export_busy_response());
    };

    // Pre-flight reads and the required start audit run on ordinary pool
    // connections and complete before the export transaction opens, so the
    // handler never holds one connection while waiting for a second.
    let resume_count = account_resume_count(&cloud.db, user.id).await?;
    let snapshot_count = account_snapshot_count(&cloud.db, user.id).await?;

    record_event_required(
        &cloud.db,
        AuditEvent {
            event_type: "account.export",
            actor_user_id: Some(user.id),
            resource_type: Some("account"),
            resource_id: Some(user.id),
            // `account.export` records that an export was authorised and
            // started; it is required so no data leaves without an audit
            // trail. Delivery is recorded separately by
            // `account.export.completed` once the stream finishes.
            // Counts are a pre-flight estimate; the exact streamed numbers
            // land on `account.export.completed`.
            metadata: serde_json::json!({
                "stage": "started",
                "resume_count": resume_count,
                "snapshot_count": snapshot_count,
            }),
            ip_address: ip,
        },
    )
    .await
    .map_err(|err| {
        error!("audit log insert failed: {err}");
        ApiError::internal("failed to record audit event")
    })?;

    // One connection, one snapshot: everything in the archive, including the
    // small collections in the prefix, is read from this REPEATABLE READ
    // transaction, which the stream task owns until it ends. The audit above
    // has already committed, so only one pool connection is held from here.
    let mut tx = cloud.db.begin().await.map_err(internal_db_error)?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *tx)
        .await
        .map_err(internal_db_error)?;
    let policy_acceptances = account_policy_acceptances(&mut *tx, user.id).await?;
    let subscriptions = account_subscriptions(&mut *tx, user.id).await?;
    let prefix_counts = PrefixCounts {
        policy_acceptances: policy_acceptances.len() as u64,
        subscriptions: subscriptions.len() as u64,
    };

    let exported_at = Utc::now();
    let account = AccountExportProfile::from_user(&user);
    let prefix = build_export_prefix(exported_at, &account, &policy_acceptances, &subscriptions)?;
    let export_stream = stream_account_export(
        cloud.db.clone(),
        tx,
        permit,
        user.id,
        prefix,
        prefix_counts,
        ip_address.clone(),
    );

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
    append_set_cookie(&mut response, &clear)?;
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

async fn account_snapshot_count<'e, E>(db: E, user_id: Uuid) -> Result<usize, ApiError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let snapshot_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM resume_snapshots s
        INNER JOIN resumes r ON r.id = s.resume_id
        WHERE r.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .map_err(internal_db_error)?;

    Ok(snapshot_count as usize)
}

async fn account_policy_acceptances<'e, E>(
    db: E,
    user_id: Uuid,
) -> Result<Vec<PolicyAcceptanceExport>, ApiError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, PolicyAcceptanceExport>(
        r#"
        SELECT policy, version, accepted_at, host(ip_address) AS ip_address
        FROM policy_acceptances
        WHERE user_id = $1
        ORDER BY accepted_at ASC, policy ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(internal_db_error)
}

async fn account_subscriptions<'e, E>(
    db: E,
    user_id: Uuid,
) -> Result<Vec<SubscriptionExport>, ApiError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query_as::<_, SubscriptionExport>(
        r#"
        SELECT paddle_subscription_id, paddle_price_id, plan, status, current_period_end,
               created_at, updated_at
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(internal_db_error)
}

fn build_export_prefix(
    exported_at: DateTime<Utc>,
    account: &AccountExportProfile,
    policy_acceptances: &[PolicyAcceptanceExport],
    subscriptions: &[SubscriptionExport],
) -> Result<Vec<u8>, ApiError> {
    let mut body = Vec::new();
    body.push(b'{');
    append_json_field(&mut body, "exported_at", &exported_at, true)?;
    append_json_field(&mut body, "account", account, false)?;
    append_json_field(&mut body, "policy_acceptances", &policy_acceptances, false)?;
    append_json_field(&mut body, "subscriptions", &subscriptions, false)?;
    body.extend_from_slice(br#","resumes":["#);
    Ok(body)
}

/// 503 with `Retry-After` for when the export concurrency ceiling is reached.
/// Same body shape as the rate limiter's 429 so clients handle both alike.
fn export_busy_response() -> Response {
    const RETRY_AFTER_SECS: u64 = 30;
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [(header::RETRY_AFTER, RETRY_AFTER_SECS.to_string())],
        Json(RateLimitErrorBody {
            error: "Too many account exports are running right now. Please try again shortly."
                .to_string(),
            retry_after: RETRY_AFTER_SECS,
        }),
    )
        .into_response()
}

/// Sizes of the collections serialised in the prefix, for the completion audit.
#[derive(Debug, Clone, Copy)]
struct PrefixCounts {
    policy_acceptances: u64,
    subscriptions: u64,
}

/// Outcome of the detached export stream, recorded as `account.export.completed`.
#[derive(Debug, Default, PartialEq, Eq)]
struct ExportOutcome {
    /// True only when the closing `]}` was handed to the client.
    delivered: bool,
    bytes_streamed: u64,
    resumes_streamed: u64,
    snapshots_streamed: u64,
    audit_events_streamed: u64,
    /// Why delivery stopped short, when it did.
    error: Option<String>,
}

/// Byte-counting wrapper around the chunk channel.
///
/// `send` returns `false` when the client has gone away (receiver dropped) so
/// callers can abort the DB cursor immediately.
struct ChunkSink {
    tx: mpsc::Sender<Result<Bytes, io::Error>>,
    bytes_streamed: u64,
    resumes_streamed: u64,
    snapshots_streamed: u64,
    audit_events_streamed: u64,
}

impl ChunkSink {
    async fn send(&mut self, chunk: Bytes) -> bool {
        let len = chunk.len() as u64;
        if self.tx.send(Ok(chunk)).await.is_err() {
            return false;
        }
        self.bytes_streamed += len;
        true
    }

    async fn fail(&self, message: String) {
        let _ = self.tx.send(Err(io::Error::other(message))).await;
    }

    fn outcome(&self, delivered: bool, error: Option<String>) -> ExportOutcome {
        ExportOutcome {
            delivered,
            bytes_streamed: self.bytes_streamed,
            resumes_streamed: self.resumes_streamed,
            snapshots_streamed: self.snapshots_streamed,
            audit_events_streamed: self.audit_events_streamed,
            error,
        }
    }
}

fn stream_account_export(
    pool: sqlx::PgPool,
    db_tx: sqlx::Transaction<'static, sqlx::Postgres>,
    permit: OwnedSemaphorePermit,
    user_id: Uuid,
    prefix: Vec<u8>,
    prefix_counts: PrefixCounts,
    ip_address: Option<String>,
) -> impl Stream<Item = Result<Bytes, io::Error>> + Send + 'static {
    let (chunk_tx, chunk_rx) =
        mpsc::channel::<Result<Bytes, io::Error>>(EXPORT_STREAM_CHANNEL_CAPACITY);

    tokio::spawn(async move {
        // Held until this task ends, i.e. until the transaction (and its
        // connection) is gone, whichever way the stream finishes.
        let _permit = permit;
        let sink = ChunkSink {
            tx: chunk_tx.clone(),
            bytes_streamed: 0,
            resumes_streamed: 0,
            snapshots_streamed: 0,
            audit_events_streamed: 0,
        };

        // The HTTP status has already been sent by the time this task runs, so
        // a panic here would otherwise vanish with the dropped JoinHandle and
        // the client would see a silently truncated body.
        let outcome = match AssertUnwindSafe(run_export_stream(db_tx, user_id, prefix, sink))
            .catch_unwind()
            .await
        {
            Ok(outcome) => outcome,
            Err(_) => {
                error!(user_id = %user_id, "account export stream task panicked");
                let _ = chunk_tx
                    .send(Err(io::Error::other("account export failed")))
                    .await;
                ExportOutcome {
                    error: Some("stream task panicked".to_string()),
                    ..ExportOutcome::default()
                }
            }
        };
        drop(chunk_tx);

        if !outcome.delivered {
            warn!(
                user_id = %user_id,
                bytes_streamed = outcome.bytes_streamed,
                error = outcome.error.as_deref().unwrap_or("client disconnected"),
                "account export not delivered"
            );
        }

        record_event(
            &pool,
            AuditEvent {
                event_type: "account.export.completed",
                actor_user_id: Some(user_id),
                resource_type: Some("account"),
                resource_id: Some(user_id),
                metadata: serde_json::json!({
                    "delivered": outcome.delivered,
                    "bytes_streamed": outcome.bytes_streamed,
                    "policy_acceptances": prefix_counts.policy_acceptances,
                    "subscriptions": prefix_counts.subscriptions,
                    "resumes_streamed": outcome.resumes_streamed,
                    "snapshots_streamed": outcome.snapshots_streamed,
                    "audit_events_streamed": outcome.audit_events_streamed,
                    "error": outcome.error,
                }),
                ip_address: ip_address.as_deref(),
            },
        )
        .await;
    });

    stream::unfold(chunk_rx, |mut chunk_rx| async move {
        chunk_rx.recv().await.map(|item| (item, chunk_rx))
    })
}

/// Stream the export body. Returns how far delivery got; never panics on
/// expected failures (DB errors, client disconnect).
async fn run_export_stream(
    mut db_tx: sqlx::Transaction<'static, sqlx::Postgres>,
    user_id: Uuid,
    prefix: Vec<u8>,
    mut sink: ChunkSink,
) -> ExportOutcome {
    if !sink.send(Bytes::from(prefix)).await {
        return sink.outcome(false, None);
    }

    let mut rows = sqlx::query_as::<_, ExportResumeRow>(
        r#"
        SELECT /* account-export: resumes */
               id, title, is_public, public_slug, created_at, updated_at, data::text AS data_json
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch(&mut *db_tx);

    let mut first_resume = true;
    loop {
        let row = match rows.try_next().await {
            Ok(Some(row)) => row,
            Ok(None) => break,
            Err(err) => {
                let message = internal_db_error(err).error;
                sink.fail(message.clone()).await;
                return sink.outcome(false, Some(message));
            }
        };
        match stream_resume_row(&mut sink, row, &mut first_resume).await {
            Ok(true) => sink.resumes_streamed += 1,
            // Client disconnected: stop fetching so the cursor and
            // transaction are dropped immediately.
            Ok(false) => return sink.outcome(false, None),
            Err(err) => {
                sink.fail(err.error.clone()).await;
                return sink.outcome(false, Some(err.error));
            }
        }
    }
    drop(rows);

    if !sink
        .send(Bytes::from_static(br#"],"resume_snapshots":["#))
        .await
    {
        return sink.outcome(false, None);
    }

    let mut snapshots = sqlx::query_as::<_, ExportSnapshotRow>(
        r#"
        SELECT /* account-export: snapshots */
               s.resume_id, s.version, s.created_at, s.data::text AS data_json
        FROM resume_snapshots s
        INNER JOIN resumes r ON r.id = s.resume_id
        WHERE r.user_id = $1
        ORDER BY s.resume_id ASC, s.version ASC
        "#,
    )
    .bind(user_id)
    .fetch(&mut *db_tx);

    let mut first_snapshot = true;
    loop {
        let row = match snapshots.try_next().await {
            Ok(Some(row)) => row,
            Ok(None) => break,
            Err(err) => {
                let message = internal_db_error(err).error;
                sink.fail(message.clone()).await;
                return sink.outcome(false, Some(message));
            }
        };
        match stream_snapshot_row(&mut sink, row, &mut first_snapshot).await {
            Ok(true) => sink.snapshots_streamed += 1,
            Ok(false) => return sink.outcome(false, None),
            Err(err) => {
                sink.fail(err.error.clone()).await;
                return sink.outcome(false, Some(err.error));
            }
        }
    }
    drop(snapshots);

    if !sink
        .send(Bytes::from_static(br#"],"audit_events":["#))
        .await
    {
        return sink.outcome(false, None);
    }

    let mut audit_rows = sqlx::query_as::<_, ExportAuditRow>(
        r#"
        SELECT /* account-export: audit */
               event_type, resource_type, resource_id, host(ip_address) AS ip_address,
               created_at, metadata::text AS metadata_json
        FROM audit_events
        WHERE actor_user_id = $1
        ORDER BY created_at ASC, id ASC
        "#,
    )
    .bind(user_id)
    .fetch(&mut *db_tx);

    let mut first_event = true;
    loop {
        let row = match audit_rows.try_next().await {
            Ok(Some(row)) => row,
            Ok(None) => break,
            Err(err) => {
                let message = internal_db_error(err).error;
                sink.fail(message.clone()).await;
                return sink.outcome(false, Some(message));
            }
        };
        match stream_audit_row(&mut sink, row, &mut first_event).await {
            Ok(true) => sink.audit_events_streamed += 1,
            Ok(false) => return sink.outcome(false, None),
            Err(err) => {
                sink.fail(err.error.clone()).await;
                return sink.outcome(false, Some(err.error));
            }
        }
    }
    drop(audit_rows);

    if !sink.send(Bytes::from_static(b"]}")).await {
        return sink.outcome(false, None);
    }

    // The transaction only ever read under REPEATABLE READ, so a failed
    // commit cannot lose or corrupt data; it is logged for operators and
    // does not affect the bytes already delivered.
    if let Err(err) = db_tx.commit().await {
        error!("account export transaction commit failed: {err}");
    }

    sink.outcome(true, None)
}

/// Stream one resume row. Returns `Ok(false)` when the client disconnects so
/// the caller can abort the DB cursor immediately.
async fn stream_resume_row(
    sink: &mut ChunkSink,
    row: ExportResumeRow,
    first: &mut bool,
) -> Result<bool, ApiError> {
    // Everything except the (possibly huge) `data` document is serialised with
    // serde so escaping and the optional slug follow the schema exactly.
    #[derive(Serialize)]
    struct Head<'a> {
        id: Uuid,
        title: &'a str,
        is_public: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        public_slug: Option<&'a str>,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    }
    let mut header = serde_json::to_string(&Head {
        id: row.id,
        title: &row.title,
        is_public: row.is_public,
        public_slug: row.public_slug.as_deref(),
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
    .map_err(|err| {
        error!("account export resume header serialization failed: {err}");
        ApiError::internal("failed to export account data")
    })?;
    // Replace the closing brace with the `data` key so the raw JSON document
    // can be appended as the last field.
    header.pop();
    let header = format!(r#"{}{header},"data":"#, take_separator(first));
    stream_json_object(sink, header, &row.data_json).await
}

/// Stream one resume snapshot row. Returns `Ok(false)` when the client
/// disconnects so the caller can abort the DB cursor immediately.
async fn stream_snapshot_row(
    sink: &mut ChunkSink,
    row: ExportSnapshotRow,
    first: &mut bool,
) -> Result<bool, ApiError> {
    // Same approach as resumes: serde for every field except the raw `data`
    // document, so the streamed object tracks `ResumeSnapshotExport`.
    #[derive(Serialize)]
    struct Head {
        resume_id: Uuid,
        version: i32,
        created_at: DateTime<Utc>,
    }
    let mut header = serde_json::to_string(&Head {
        resume_id: row.resume_id,
        version: row.version,
        created_at: row.created_at,
    })
    .map_err(|err| {
        error!("account export snapshot header serialization failed: {err}");
        ApiError::internal("failed to export account data")
    })?;
    header.pop();
    let header = format!(r#"{}{header},"data":"#, take_separator(first));
    stream_json_object(sink, header, &row.data_json).await
}

/// Stream one audit event row. Returns `Ok(false)` when the client
/// disconnects so the caller can abort the DB cursor immediately.
async fn stream_audit_row(
    sink: &mut ChunkSink,
    row: ExportAuditRow,
    first: &mut bool,
) -> Result<bool, ApiError> {
    #[derive(Serialize)]
    struct Head<'a> {
        event_type: &'a str,
        #[serde(skip_serializing_if = "Option::is_none")]
        resource_type: Option<&'a str>,
        #[serde(skip_serializing_if = "Option::is_none")]
        resource_id: Option<Uuid>,
        #[serde(skip_serializing_if = "Option::is_none")]
        ip_address: Option<&'a str>,
        created_at: DateTime<Utc>,
    }
    let mut header = serde_json::to_string(&Head {
        event_type: &row.event_type,
        resource_type: row.resource_type.as_deref(),
        resource_id: row.resource_id,
        ip_address: row.ip_address.as_deref(),
        created_at: row.created_at,
    })
    .map_err(|err| {
        error!("account export audit header serialization failed: {err}");
        ApiError::internal("failed to export account data")
    })?;
    header.pop();
    let header = format!(r#"{}{header},"metadata":"#, take_separator(first));
    stream_json_object(sink, header, &row.metadata_json).await
}

/// Return the array separator for the current element and clear `first`.
fn take_separator(first: &mut bool) -> &'static str {
    if *first {
        *first = false;
        ""
    } else {
        ","
    }
}

/// Send a pre-rendered object header, the raw JSON `data` value in bounded
/// chunks, and the closing brace. Returns `Ok(false)` on client disconnect.
async fn stream_json_object(
    sink: &mut ChunkSink,
    header: String,
    data_json: &str,
) -> Result<bool, ApiError> {
    if !sink.send(Bytes::from(header)).await {
        return Ok(false);
    }

    for chunk in data_json.as_bytes().chunks(EXPORT_STREAM_CHUNK_BYTES) {
        if !sink.send(Bytes::copy_from_slice(chunk)).await {
            return Ok(false);
        }
    }

    if !sink.send(Bytes::from_static(b"}")).await {
        return Ok(false);
    }

    Ok(true)
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

fn internal_db_error(err: impl std::fmt::Display) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
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
    use crate::auth::{session::SessionService, workos::WorkOsClient};
    use crate::cloud::CloudState;
    use crate::email::EmailService;

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
        let Some(url) = std::env::var("TEST_DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())
            .or_else(|| {
                std::env::var("DATABASE_URL")
                    .ok()
                    .map(|url| url.trim().to_owned())
                    .filter(|url| !url.is_empty())
            })
        else {
            skip_or_fail_without_test_db();
            return None;
        };

        if looks_like_test_database_url(&url) {
            Some(url)
        } else {
            skip_or_fail_without_test_db();
            None
        }
    }

    /// Locally the DB-backed tests are optional; in CI (which always provisions
    /// Postgres) a missing or misnamed database must fail rather than pass
    /// with zero assertions.
    fn skip_or_fail_without_test_db() {
        let message = "account export integration tests need TEST_DATABASE_URL (or DATABASE_URL) naming a *_test database";
        if std::env::var("CI").is_ok() {
            panic!("{message}");
        }
        eprintln!("SKIP {message}");
    }

    /// Export integration tests share one database and some of them park or
    /// terminate streaming connections, so they run one at a time.
    static EXPORT_TESTS: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
            INSERT INTO users (id, workos_id, email, first_name, last_name, plan, paddle_customer_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(user_id)
        .bind(&workos_id)
        .bind(format!("account-export-{user_id}@example.com"))
        .bind("Ada")
        .bind("Lovelace")
        .bind("free")
        // Non-null so the forbidden-key assertions actually protect something.
        .bind(format!("ctm_export_{user_id}"))
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

    async fn seed_snapshots_and_policy_acceptances(pool: &sqlx::PgPool, user_id: Uuid) {
        let resume_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM resumes WHERE user_id = $1 ORDER BY title ASC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .expect("fetch seeded resume ids");

        for resume_id in resume_ids {
            for version in 1..=2 {
                sqlx::query(
                    "INSERT INTO resume_snapshots (resume_id, version, data) VALUES ($1, $2, $3)",
                )
                .bind(resume_id)
                .bind(version)
                .bind(serde_json::json!({ "snapshot_version": version }))
                .execute(pool)
                .await
                .expect("insert resume snapshot");
            }
        }

        for (policy, version) in [("terms", "2026-01-01"), ("privacy", "2026-01-01")] {
            sqlx::query(
                r#"
                INSERT INTO policy_acceptances (user_id, policy, version, ip_address)
                VALUES ($1, $2, $3, $4::inet)
                "#,
            )
            .bind(user_id)
            .bind(policy)
            .bind(version)
            .bind("203.0.113.7")
            .execute(pool)
            .await
            .expect("insert policy acceptance");
        }
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
        test_app_state_with_rate_limits(pool, crate::config::RateLimitConfig::default())
    }

    fn test_app_state_with_rate_limits(
        pool: sqlx::PgPool,
        rate_limits: crate::config::RateLimitConfig,
    ) -> AppState {
        let sessions_pool = pool.clone();
        AppState::with_options(
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
            rate_limits,
        )
    }

    async fn read_export_body(response: Response) -> Bytes {
        axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read account export body")
    }

    async fn read_export_payload(response: Response) -> serde_json::Value {
        let body = read_export_body(response).await;
        serde_json::from_slice(&body).expect("parse account export JSON")
    }

    async fn wait_for_completion_audit(pool: &sqlx::PgPool, user_id: Uuid) -> serde_json::Value {
        // The completion event is written by the detached stream task after
        // the last chunk is consumed, so allow it a moment to land.
        for _ in 0..50 {
            let row: Option<serde_json::Value> = sqlx::query_scalar(
                r#"
                SELECT metadata FROM audit_events
                WHERE actor_user_id = $1 AND event_type = 'account.export.completed'
                ORDER BY created_at DESC LIMIT 1
                "#,
            )
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .expect("query completion audit");
            if let Some(row) = row {
                return row;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        panic!("account.export.completed audit event was not recorded");
    }

    #[tokio::test]
    async fn stream_helpers_report_client_disconnect() {
        let (tx, rx) = mpsc::channel::<Result<Bytes, io::Error>>(1);
        drop(rx);
        let mut sink = ChunkSink {
            tx,
            bytes_streamed: 0,
            resumes_streamed: 0,
            snapshots_streamed: 0,
            audit_events_streamed: 0,
        };

        let delivered = stream_json_object(&mut sink, "{\"data\":".to_string(), "{}")
            .await
            .expect("no serialization error");
        assert!(
            !delivered,
            "a dropped receiver must be reported as a disconnect"
        );
        assert_eq!(sink.bytes_streamed, 0);
        assert_eq!(
            sink.outcome(false, None),
            ExportOutcome {
                delivered: false,
                bytes_streamed: 0,
                resumes_streamed: 0,
                snapshots_streamed: 0,
                audit_events_streamed: 0,
                error: None,
            }
        );
    }

    #[tokio::test]
    async fn stream_helpers_count_delivered_bytes() {
        let (tx, mut rx) = mpsc::channel::<Result<Bytes, io::Error>>(8);
        let mut sink = ChunkSink {
            tx,
            bytes_streamed: 0,
            resumes_streamed: 0,
            snapshots_streamed: 0,
            audit_events_streamed: 0,
        };
        let mut first = true;

        let header_and_body = tokio::spawn(async move {
            let mut out = Vec::new();
            while let Some(Ok(chunk)) = rx.recv().await {
                out.extend_from_slice(&chunk);
            }
            out
        });

        let row = ExportResumeRow {
            id: Uuid::nil(),
            title: "Quote \"me\"".to_string(),
            is_public: true,
            public_slug: Some("ada-lovelace".to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            data_json: r#"{"basics":{"name":"Ada"}}"#.to_string(),
        };
        assert!(stream_resume_row(&mut sink, row, &mut first).await.unwrap());
        assert!(!first);
        let bytes = sink.bytes_streamed;
        drop(sink);

        let out = header_and_body.await.unwrap();
        assert_eq!(out.len() as u64, bytes);
        let item: crate::db::AccountResumeExportItem =
            serde_json::from_slice(&out).expect("streamed resume item is valid JSON");
        assert_eq!(item.title, "Quote \"me\"");
        assert!(item.is_public);
        assert_eq!(item.public_slug.as_deref(), Some("ada-lovelace"));
        assert_eq!(item.data["basics"]["name"], "Ada");
    }

    #[tokio::test]
    async fn export_account_returns_account_fields_and_resumes() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 2).await;
        seed_snapshots_and_policy_acceptances(&pool, user.id).await;
        seed_expired_subscription(&pool, user.id).await;
        // One resume is shared publicly so the export carries sharing state.
        let shared_slug = format!("shared-{}", &user.id.simple().to_string()[..8]);
        sqlx::query(
            "UPDATE resumes SET is_public = true, public_slug = $2 WHERE user_id = $1 AND title = 'Resume 0'",
        )
        .bind(user.id)
        .bind(&shared_slug)
        .execute(&pool)
        .await
        .expect("share resume");
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("expected account export to succeed");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_DISPOSITION).unwrap(),
            "attachment; filename=\"rustume-account-export.json\"",
        );

        let body = read_export_body(response).await;
        let completion = wait_for_completion_audit(&pool, user.id).await;
        cleanup_user(&pool, user.id).await;

        // Round-trip: the hand-assembled stream must deserialize into the
        // documented `AccountDataExport` schema, so the OpenAPI body and the
        // byte-spliced output cannot drift apart unnoticed.
        let typed: AccountDataExport =
            serde_json::from_slice(&body).expect("stream matches AccountDataExport schema");
        assert_eq!(typed.account.id, user.id);
        assert_eq!(typed.resumes.len(), 2);
        let shared = typed
            .resumes
            .iter()
            .find(|resume| resume.title == "Resume 0")
            .expect("shared resume");
        assert!(shared.is_public);
        assert_eq!(shared.public_slug.as_deref(), Some(shared_slug.as_str()));
        let private = typed
            .resumes
            .iter()
            .find(|resume| resume.title == "Resume 1")
            .expect("private resume");
        assert!(!private.is_public);
        assert_eq!(private.public_slug, None);
        assert_eq!(typed.resume_snapshots.len(), 4);
        assert_eq!(typed.policy_acceptances.len(), 2);
        assert_eq!(typed.subscriptions.len(), 1);
        assert_eq!(typed.subscriptions[0].plan, "pro");
        assert_eq!(typed.subscriptions[0].status, "canceled");
        // The audit trail includes this very export's start event (committed
        // before the snapshot was taken) and the seeded policy acceptances.
        assert!(typed
            .audit_events
            .iter()
            .any(|event| event.event_type == "account.export"
                && event.metadata["stage"] == "started"));
        assert!(typed
            .audit_events
            .windows(2)
            .all(|pair| pair[0].created_at <= pair[1].created_at));

        assert_eq!(completion["delivered"], true);
        assert_eq!(completion["bytes_streamed"], body.len() as u64);
        assert_eq!(completion["resumes_streamed"], 2);
        assert_eq!(completion["snapshots_streamed"], 4);
        assert_eq!(
            completion["audit_events_streamed"].as_u64().expect("count"),
            typed.audit_events.len() as u64
        );
        assert_eq!(completion["policy_acceptances"], 2);
        assert_eq!(completion["subscriptions"], 1);
        assert!(completion["error"].is_null());

        let payload: serde_json::Value = serde_json::from_slice(&body).expect("parse JSON");

        // Sensitive and internal fields must never appear in the export.
        let account_keys: std::collections::BTreeSet<&str> = payload["account"]
            .as_object()
            .expect("account object")
            .keys()
            .map(String::as_str)
            .collect();
        for forbidden in ["workos_id", "paddle_customer_id", "updated_at"] {
            assert!(
                !account_keys.contains(forbidden),
                "account leaked {forbidden}"
            );
        }
        for resume in payload["resumes"].as_array().expect("resumes array") {
            let keys: std::collections::BTreeSet<&str> = resume
                .as_object()
                .expect("resume object")
                .keys()
                .map(String::as_str)
                .collect();
            let mut expected: std::collections::BTreeSet<&str> = [
                "id",
                "title",
                "is_public",
                "created_at",
                "updated_at",
                "data",
            ]
            .into_iter()
            .collect();
            if resume["is_public"] == true {
                expected.insert("public_slug");
            }
            assert_eq!(keys, expected);
            // Never the owner id or the password hash for protected shares.
            assert!(!keys.contains("user_id"));
            assert!(!keys.contains("password_hash"));
        }
        for snapshot in payload["resume_snapshots"]
            .as_array()
            .expect("snapshots array")
        {
            let keys: std::collections::BTreeSet<&str> = snapshot
                .as_object()
                .expect("snapshot object")
                .keys()
                .map(String::as_str)
                .collect();
            assert_eq!(
                keys,
                ["resume_id", "version", "created_at", "data"]
                    .into_iter()
                    .collect()
            );
        }

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

        let acceptances = payload["policy_acceptances"]
            .as_array()
            .expect("policy_acceptances array");
        assert_eq!(acceptances.len(), 2);
        let policies: Vec<&str> = acceptances
            .iter()
            .map(|row| row["policy"].as_str().expect("policy name"))
            .collect();
        assert!(policies.contains(&"terms"));
        assert!(policies.contains(&"privacy"));
        assert!(acceptances
            .iter()
            .all(|row| row["version"] == "2026-01-01" && row["ip_address"] == "203.0.113.7"));

        let snapshots = payload["resume_snapshots"]
            .as_array()
            .expect("resume_snapshots array");
        assert_eq!(snapshots.len(), 4);
        let resume_ids: std::collections::HashSet<&str> = payload["resumes"]
            .as_array()
            .expect("resumes array")
            .iter()
            .map(|resume| resume["id"].as_str().expect("resume id"))
            .collect();
        for snapshot in snapshots {
            assert!(
                resume_ids.contains(snapshot["resume_id"].as_str().expect("snapshot resume_id"))
            );
            let version = snapshot["version"].as_i64().expect("snapshot version");
            assert!((1..=2).contains(&version));
            assert_eq!(snapshot["data"]["snapshot_version"], version);
            assert!(snapshot["created_at"].is_string());
        }
    }

    #[tokio::test]
    async fn export_account_emits_empty_collections_without_history() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 0).await;
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("expected account export to succeed");
        let payload = read_export_payload(response).await;
        cleanup_user(&pool, user.id).await;

        assert_eq!(payload["policy_acceptances"], serde_json::json!([]));
        assert_eq!(payload["subscriptions"], serde_json::json!([]));
        assert_eq!(payload["resumes"], serde_json::json!([]));
        assert_eq!(payload["resume_snapshots"], serde_json::json!([]));
        // Only the export's own start event exists for a brand-new account.
        let events = payload["audit_events"]
            .as_array()
            .expect("audit_events array");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["event_type"], "account.export");
        let keys: std::collections::BTreeSet<&str> = events[0]
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        for forbidden in ["id", "actor_user_id"] {
            assert!(!keys.contains(forbidden), "audit event leaked {forbidden}");
        }
    }

    #[tokio::test]
    async fn export_account_writes_audit_event() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 1).await;
        seed_snapshots_and_policy_acceptances(&pool, user.id).await;
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
        assert_eq!(audit_row.3["stage"], "started");
        assert_eq!(audit_row.3["resume_count"], 1);
        assert_eq!(audit_row.3["snapshot_count"], 2);
        assert!(audit_row.3.get("policy_acceptance_count").is_none());
    }

    #[tokio::test]
    async fn export_account_records_undelivered_export_on_client_disconnect() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        // Enough resume payload that the stream cannot fit in the channel
        // buffer before the client goes away.
        let user = seed_user_with_resumes(&pool, 1).await;
        let big = serde_json::json!({ "blob": "x".repeat(EXPORT_STREAM_CHUNK_BYTES * 8) });
        sqlx::query("UPDATE resumes SET data = $1 WHERE user_id = $2")
            .bind(&big)
            .bind(user.id)
            .execute(&pool)
            .await
            .expect("inflate resume");
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("expected account export to start");
        assert_eq!(response.status(), StatusCode::OK);

        // Read one chunk, then drop the body: the client disconnected.
        {
            use futures::StreamExt;
            let mut body = response.into_body().into_data_stream();
            let first = body.next().await.expect("first chunk").expect("chunk ok");
            assert!(!first.is_empty());
        }

        let completion = wait_for_completion_audit(&pool, user.id).await;
        cleanup_user(&pool, user.id).await;

        assert_eq!(completion["delivered"], false);
        assert!(completion["error"].is_null(), "disconnect is not an error");
        let streamed = completion["bytes_streamed"].as_u64().expect("bytes");
        assert!(
            streamed < (EXPORT_STREAM_CHUNK_BYTES * 8) as u64,
            "stream must stop early on disconnect, streamed {streamed}"
        );
    }

    #[tokio::test]
    async fn export_account_succeeds_without_active_subscription() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 1).await;
        seed_expired_subscription(&pool, user.id).await;
        let state = test_app_state(pool.clone());
        let (_, cookie) = state
            .cloud()
            .expect("cloud")
            .sessions
            .create(user.id)
            .await
            .expect("create session");
        let cookie_header = format!("{}={}", SESSION_COOKIE, cookie.value());
        let app = crate::create_router_with_state(state);

        // Through the router, so the route layering is what is under test: the
        // account export must not sit behind the subscription gate that blocks
        // the bulk resume export for an expired account.
        let export = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/account/export")
                    .header(header::COOKIE, &cookie_header)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(export.status(), StatusCode::OK);
        let body = read_export_body(export).await;
        let typed: AccountDataExport = serde_json::from_slice(&body).expect("valid export");
        assert_eq!(typed.subscriptions.len(), 1);

        let bulk = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/resumes/export")
                    .header(header::COOKIE, &cookie_header)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        cleanup_user(&pool, user.id).await;
        assert_eq!(bulk.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn export_account_reports_mid_stream_database_failure_when_database_available() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        // Large enough that the stream parks on the channel after the first
        // chunk, with the resume cursor still open on its connection.
        let user = seed_user_with_resumes(&pool, 2).await;
        let big = serde_json::json!({ "blob": "x".repeat(EXPORT_STREAM_CHUNK_BYTES * 8) });
        sqlx::query("UPDATE resumes SET data = $1 WHERE user_id = $2")
            .bind(&big)
            .bind(user.id)
            .execute(&pool)
            .await
            .expect("inflate resumes");
        let state = test_app_state(pool.clone());

        let response = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("export starts");
        assert_eq!(response.status(), StatusCode::OK);

        use futures::StreamExt;
        let mut body = response.into_body().into_data_stream();
        let first = body.next().await.expect("first chunk").expect("chunk ok");
        assert!(!first.is_empty());

        // Kill the backend serving the export's resume cursor (marked query,
        // not idle) from another connection: the next fetch must fail.
        let terminated: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)::bigint FROM (
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND pid <> pg_backend_pid()
                  AND state <> 'idle'
                  AND query LIKE '%account-export: resumes%'
            ) AS killed
            "#,
        )
        .fetch_one(&pool)
        .await
        .expect("terminate export backend");
        assert_eq!(
            terminated, 1,
            "expected exactly one parked export connection"
        );

        // Drain: the body must end with an error item, not a clean `]}`.
        let mut saw_error = false;
        let mut bytes = first.len();
        while let Some(item) = body.next().await {
            match item {
                Ok(chunk) => bytes += chunk.len(),
                Err(err) => {
                    saw_error = true;
                    assert_eq!(err.to_string(), "internal server error");
                    break;
                }
            }
        }
        assert!(saw_error, "stream must surface the database failure");

        let completion = wait_for_completion_audit(&pool, user.id).await;
        cleanup_user(&pool, user.id).await;
        assert_eq!(completion["delivered"], false);
        assert_eq!(completion["error"], "internal server error");
        assert!(completion["bytes_streamed"].as_u64().expect("bytes") >= bytes as u64 - 1);
    }

    #[tokio::test]
    async fn export_account_includes_all_resumes_above_bulk_export_cap() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
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
    async fn export_account_caps_concurrent_streams_when_database_available() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        // Large enough that an unread body parks the stream task on the
        // channel, keeping its permit (and connection) held.
        let big = serde_json::json!({ "blob": "x".repeat(EXPORT_STREAM_CHUNK_BYTES * 8) });
        let user = seed_user_with_resumes(&pool, 1).await;
        sqlx::query("UPDATE resumes SET data = $1 WHERE user_id = $2")
            .bind(&big)
            .bind(user.id)
            .execute(&pool)
            .await
            .expect("inflate resume");
        let state = test_app_state(pool.clone());
        assert_eq!(
            state.export_permits.available_permits(),
            crate::state::MAX_CONCURRENT_ACCOUNT_EXPORTS
        );

        let mut parked = Vec::new();
        for _ in 0..crate::state::MAX_CONCURRENT_ACCOUNT_EXPORTS {
            let response = export_account(
                AuthUser(user.clone()),
                State(state.clone()),
                HeaderMap::new(),
            )
            .await
            .expect("export starts");
            assert_eq!(response.status(), StatusCode::OK);
            parked.push(response);
        }
        assert_eq!(state.export_permits.available_permits(), 0);

        // The next export is refused up front, before any audit row or
        // transaction, with a Retry-After hint.
        let busy = export_account(
            AuthUser(user.clone()),
            State(state.clone()),
            HeaderMap::new(),
        )
        .await
        .expect("busy is a response, not an error");
        assert_eq!(busy.status(), StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(busy.headers().get(header::RETRY_AFTER).unwrap(), "30");
        let payload: serde_json::Value =
            serde_json::from_slice(&read_export_body(busy).await).expect("busy body is JSON");
        assert!(payload["error"].as_str().is_some());
        assert_eq!(payload["retry_after"], 30);

        // Drain (finish) the parked downloads: permits come back.
        for response in parked {
            let _ = read_export_body(response).await;
        }
        for _ in 0..50 {
            if state.export_permits.available_permits()
                == crate::state::MAX_CONCURRENT_ACCOUNT_EXPORTS
            {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        assert_eq!(
            state.export_permits.available_permits(),
            crate::state::MAX_CONCURRENT_ACCOUNT_EXPORTS
        );

        let again = export_account(AuthUser(user.clone()), State(state), HeaderMap::new())
            .await
            .expect("export resumes once a slot is free");
        assert_eq!(again.status(), StatusCode::OK);
        let _ = read_export_body(again).await;

        // Only the started exports produced audit rows; the refused one did not.
        let started: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM audit_events WHERE actor_user_id = $1 AND event_type = 'account.export'",
        )
        .bind(user.id)
        .fetch_one(&pool)
        .await
        .expect("count start audits");
        cleanup_user(&pool, user.id).await;
        assert_eq!(
            started as usize,
            crate::state::MAX_CONCURRENT_ACCOUNT_EXPORTS + 1
        );
    }

    #[tokio::test]
    async fn export_account_enforces_per_user_quota_when_database_available() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let _serial = EXPORT_TESTS.lock().await;
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 1).await;
        let state = test_app_state_with_rate_limits(
            pool.clone(),
            crate::config::RateLimitConfig {
                account_export_per_min: 1,
                ..Default::default()
            },
        );
        let (_, cookie) = state
            .cloud()
            .expect("cloud")
            .sessions
            .create(user.id)
            .await
            .expect("create session");
        let cookie_header = format!("{}={}", SESSION_COOKIE, cookie.value());
        let app = crate::create_router_with_state(state);

        let request = |cookie_header: &str| {
            Request::builder()
                .method("GET")
                .uri("/api/account/export")
                .header(header::COOKIE, cookie_header)
                .body(Body::empty())
                .unwrap()
        };

        let first = app.clone().oneshot(request(&cookie_header)).await.unwrap();
        assert_eq!(first.status(), StatusCode::OK);
        let _ = axum::body::to_bytes(first.into_body(), usize::MAX).await;

        let second = app.oneshot(request(&cookie_header)).await.unwrap();
        cleanup_user(&pool, user.id).await;
        assert_eq!(second.status(), StatusCode::TOO_MANY_REQUESTS);
        assert!(second.headers().contains_key("retry-after"));
        let body = axum::body::to_bytes(second.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(payload["error"].as_str().is_some());
        assert!(payload["retry_after"].as_u64().is_some());
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
