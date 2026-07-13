//! Authenticated resume CRUD routes for Rustume Cloud.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use tracing::error;
use uuid::Uuid;

use crate::audit::{record_event, AuditEvent};
use crate::db::{
    capture_resume_snapshot, get_resume_snapshot, list_resume_snapshots, restore_resume_snapshot,
    CreateResumeRequest, ImportFailure, ImportResumeItem, ImportResumesRequest,
    ImportResumesResponse, PaginatedResumeSummaries, RestoreResumeRequest, ResumeListQuery,
    ResumeRow, ResumeSnapshot, ResumeSummary, ResumeVersionSummary, UpdateResumeRequest,
};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;
use crate::subscription;
use crate::validation::{validate_resume_json, validate_title};

/// List resumes for the authenticated user.
#[utoipa::path(
    get,
    path = "/api/resumes",
    tag = "Resumes",
    params(ResumeListQuery),
    responses(
        (status = 200, description = "Paginated resume summaries", body = PaginatedResumeSummaries),
        (status = 401, description = "Not authenticated", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn list_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ResumeListQuery>,
) -> Result<Json<PaginatedResumeSummaries>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_read()?;
    let (page, per_page, offset) = query.normalized();

    let total = sqlx::query_scalar::<_, i64>(
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

    let items = sqlx::query_as::<_, ResumeSummary>(
        r#"
        SELECT id, title, updated_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user.id)
    .bind(i64::from(per_page))
    .bind(offset)
    .fetch_all(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    Ok(Json(PaginatedResumeSummaries {
        items,
        total,
        page,
        per_page,
    }))
}

/// Fetch a resume owned by the authenticated user.
#[utoipa::path(
    get,
    path = "/api/resumes/{id}",
    tag = "Resumes",
    params(("id" = String, Path, description = "Resume ID")),
    responses(
        (status = 200, description = "Resume record", body = ResumeRow),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume not found", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn get_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ResumeRow>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_read()?;
    fetch_owned_resume(&state, user.id, id).await.map(Json)
}

/// Create a resume for the authenticated user.
#[utoipa::path(
    post,
    path = "/api/resumes",
    tag = "Resumes",
    request_body = CreateResumeRequest,
    responses(
        (status = 201, description = "Resume created", body = ResumeRow),
        (status = 401, description = "Not authenticated", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn create_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateResumeRequest>,
) -> Result<(StatusCode, Json<ResumeRow>), ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_write()?;
    let title = body.title.unwrap_or_else(|| "Untitled".to_string());
    validate_title(title.as_str())?;
    validate_resume_json(&body.data)?;
    let resume_id = body.id.unwrap_or_else(Uuid::new_v4);

    let row = sqlx::query_as::<_, ResumeRow>(
        r#"
        INSERT INTO resumes (id, user_id, title, data)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(resume_id)
    .bind(user.id)
    .bind(title)
    .bind(body.data)
    .fetch_one(&cloud.db)
    .await
    .map_err(map_resume_db_error)?;

    Ok((StatusCode::CREATED, Json(row)))
}

/// Update a resume owned by the authenticated user.
#[utoipa::path(
    put,
    path = "/api/resumes/{id}",
    tag = "Resumes",
    params(("id" = String, Path, description = "Resume ID")),
    request_body = UpdateResumeRequest,
    responses(
        (status = 200, description = "Resume updated", body = ResumeRow),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume not found", body = ApiError),
        (status = 409, description = "Resume version conflict", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn update_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateResumeRequest>,
) -> Result<Json<ResumeRow>, ApiError> {
    if body.title.is_none() && body.data.is_none() {
        return Err(ApiError::new("At least one of title or data is required"));
    }

    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_write()?;
    let existing = fetch_owned_resume(&state, user.id, id).await?;
    let title = body.title.unwrap_or(existing.title);
    validate_title(title.as_str())?;
    if let Some(data) = &body.data {
        validate_resume_json(data)?;
    }

    let row = apply_resume_update(&cloud.db, user.id, id, &title, body.data, body.version).await?;

    Ok(Json(row))
}

/// List version history for a resume owned by the authenticated user.
#[utoipa::path(
    get,
    path = "/api/resumes/{id}/versions",
    tag = "Resumes",
    params(("id" = String, Path, description = "Resume ID")),
    responses(
        (status = 200, description = "Version summaries (newest first)", body = [ResumeVersionSummary]),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume not found", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn list_resume_versions(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ResumeVersionSummary>>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_read()?;
    fetch_owned_resume(&state, user.id, id).await?;
    let versions = list_resume_snapshots(&cloud.db, id).await?;
    Ok(Json(versions))
}

/// Fetch a historical resume snapshot owned by the authenticated user.
#[utoipa::path(
    get,
    path = "/api/resumes/{id}/versions/{version}",
    tag = "Resumes",
    params(
        ("id" = String, Path, description = "Resume ID"),
        ("version" = i32, Path, description = "Snapshot version"),
    ),
    responses(
        (status = 200, description = "Snapshot payload", body = ResumeSnapshot),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume or version not found", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn get_resume_version(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path((id, version)): Path<(Uuid, i32)>,
) -> Result<Json<ResumeSnapshot>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_read()?;
    let snapshot = get_resume_snapshot(&cloud.db, user.id, id, version).await?;
    Ok(Json(snapshot))
}

/// Restore a historical snapshot as the current resume state.
#[utoipa::path(
    post,
    path = "/api/resumes/{id}/versions/{version}/restore",
    tag = "Resumes",
    params(
        ("id" = String, Path, description = "Resume ID"),
        ("version" = i32, Path, description = "Snapshot version to restore"),
    ),
    request_body = RestoreResumeRequest,
    responses(
        (status = 200, description = "Resume restored", body = ResumeRow),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume or version not found", body = ApiError),
        (status = 409, description = "Resume version conflict", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn restore_resume_version(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path((id, version)): Path<(Uuid, i32)>,
    Json(body): Json<RestoreResumeRequest>,
) -> Result<Json<ResumeRow>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_write()?;
    let row = restore_resume_snapshot(&cloud.db, user.id, id, version, body.version).await?;
    Ok(Json(row))
}

/// Delete a resume owned by the authenticated user.
#[utoipa::path(
    delete,
    path = "/api/resumes/{id}",
    tag = "Resumes",
    params(("id" = String, Path, description = "Resume ID")),
    responses(
        (status = 204, description = "Resume deleted"),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 404, description = "Resume not found", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn delete_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<StatusCode, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_delete()?;
    let result = sqlx::query("DELETE FROM resumes WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&cloud.db)
        .await
        .map_err(internal_db_error)?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Resume not found"));
    }

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "resume.delete",
            actor_user_id: Some(user.id),
            resource_type: Some("resume"),
            resource_id: Some(id),
            metadata: serde_json::json!({}),
            ip_address: trusted_client_ip(&headers, net::trusted_proxy_enabled()).as_deref(),
        },
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

const MAX_IMPORT_BATCH: usize = 100;

/// Import local resumes into the authenticated user's cloud account.
#[utoipa::path(
    post,
    path = "/api/resumes/import",
    tag = "Resumes",
    request_body = ImportResumesRequest,
    responses(
        (status = 200, description = "Import results with per-item failures", body = ImportResumesResponse),
        (status = 401, description = "Not authenticated", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn import_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<ImportResumesRequest>,
) -> Result<Json<ImportResumesResponse>, ApiError> {
    if body.resumes.len() > MAX_IMPORT_BATCH {
        return Err(ApiError::new(format!(
            "Import batch exceeds maximum of {MAX_IMPORT_BATCH} resumes"
        )));
    }

    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_write()?;
    let requested_count = body.resumes.len();
    let mut imported = Vec::new();
    let mut failed = Vec::new();

    for item in body.resumes {
        let resume_id = item.id;
        if let Err(err) = validate_title(item.title.as_deref().unwrap_or("Untitled")) {
            failed.push(ImportFailure {
                id: resume_id,
                error: err.error,
            });
            continue;
        }
        if let Err(err) = validate_resume_json(&item.data) {
            failed.push(ImportFailure {
                id: resume_id,
                error: err.error,
            });
            continue;
        }
        match import_single_resume(&cloud.db, user.id, item).await {
            Ok(row) => imported.push(ResumeSummary::from(row)),
            Err(err) => failed.push(ImportFailure {
                id: resume_id,
                error: err.error,
            }),
        }
    }

    record_event(
        &cloud.db,
        AuditEvent {
            event_type: "resume.import.batch",
            actor_user_id: Some(user.id),
            resource_type: None,
            resource_id: None,
            metadata: serde_json::json!({
                "requested": requested_count,
                "imported": imported.len(),
                "failed": failed.len(),
            }),
            ip_address: trusted_client_ip(&headers, net::trusted_proxy_enabled()).as_deref(),
        },
    )
    .await;

    Ok(Json(ImportResumesResponse { imported, failed }))
}

async fn import_single_resume(
    db: &sqlx::PgPool,
    user_id: Uuid,
    item: ImportResumeItem,
) -> Result<ResumeRow, ApiError> {
    let title = item.title.unwrap_or_else(|| "Untitled".to_string());
    let resume_id = item.id.unwrap_or_else(Uuid::new_v4);

    sqlx::query_as::<_, ResumeRow>(
        r#"
        INSERT INTO resumes (id, user_id, title, data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            data = EXCLUDED.data,
            updated_at = now()
        WHERE resumes.user_id = EXCLUDED.user_id
        RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(resume_id)
    .bind(user_id)
    .bind(title)
    .bind(item.data)
    .fetch_one(db)
    .await
    .map_err(|err| map_import_db_error(err, resume_id))
}

fn internal_db_error(err: impl std::fmt::Display + Send + Sync + 'static) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
}

fn map_import_db_error(err: sqlx::Error, resume_id: Uuid) -> ApiError {
    if matches!(err, sqlx::Error::RowNotFound) {
        return ApiError::conflict(format!(
            "Resume ID {resume_id} already exists for another user"
        ));
    }
    map_resume_db_error(err)
}

fn map_resume_db_error(err: sqlx::Error) -> ApiError {
    if matches!(err, sqlx::Error::RowNotFound) {
        return ApiError::not_found("Resume not found");
    }
    if let sqlx::Error::Database(db_err) = &err {
        if db_err.code().as_deref() == Some("23505") {
            return ApiError::conflict("A resume with this ID already exists");
        }
    }
    internal_db_error(err)
}

async fn apply_resume_update(
    db: &sqlx::PgPool,
    user_id: Uuid,
    resume_id: Uuid,
    title: &str,
    data: Option<serde_json::Value>,
    expected_version: Option<i32>,
) -> Result<ResumeRow, ApiError> {
    let mut tx = db.begin().await.map_err(internal_db_error)?;

    let row = match (data, expected_version) {
        (Some(data), Some(version)) => {
            sqlx::query_as::<_, ResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    data = $2,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $3 AND user_id = $4 AND version = $5
                RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(data)
            .bind(resume_id)
            .bind(user_id)
            .bind(version)
            .fetch_optional(&mut *tx)
            .await
        }
        (Some(data), None) => {
            sqlx::query_as::<_, ResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    data = $2,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $3 AND user_id = $4
                RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(data)
            .bind(resume_id)
            .bind(user_id)
            .fetch_optional(&mut *tx)
            .await
        }
        (None, Some(version)) => {
            sqlx::query_as::<_, ResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $2 AND user_id = $3 AND version = $4
                RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(resume_id)
            .bind(user_id)
            .bind(version)
            .fetch_optional(&mut *tx)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, ResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $2 AND user_id = $3
                RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(resume_id)
            .bind(user_id)
            .fetch_optional(&mut *tx)
            .await
        }
    }
    .map_err(map_resume_db_error)?;

    match row {
        Some(row) => {
            capture_resume_snapshot(&mut tx, resume_id, row.version, &row.data).await?;
            tx.commit().await.map_err(internal_db_error)?;
            Ok(row)
        }
        None => {
            tx.rollback().await.ok();
            map_update_miss(db, user_id, resume_id, expected_version).await
        }
    }
}

async fn map_update_miss(
    db: &sqlx::PgPool,
    user_id: Uuid,
    resume_id: Uuid,
    expected_version: Option<i32>,
) -> Result<ResumeRow, ApiError> {
    let current = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT version
        FROM resumes
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(resume_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(internal_db_error)?;

    match (current, expected_version) {
        (Some(current_version), Some(_)) => Err(ApiError::version_conflict(
            "Resume was modified by another session",
            current_version,
        )),
        _ => Err(ApiError::not_found("Resume not found")),
    }
}

async fn fetch_owned_resume(
    state: &AppState,
    user_id: Uuid,
    resume_id: Uuid,
) -> Result<ResumeRow, ApiError> {
    let cloud = state.cloud()?;
    sqlx::query_as::<_, ResumeRow>(
        r#"
        SELECT id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        FROM resumes
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(resume_id)
    .bind(user_id)
    .fetch_optional(&cloud.db)
    .await
    .map_err(internal_db_error)?
    .ok_or_else(|| ApiError::not_found("Resume not found"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{session::SessionService, workos::WorkOsClient};
    use crate::cloud::CloudState;
    use crate::db::{User, MAX_SNAPSHOTS_PER_RESUME};
    use crate::email::EmailService;
    use crate::error::ApiErrorKind;
    use crate::middleware::auth::AuthUser;
    use sqlx::postgres::PgPoolOptions;
    use std::sync::Arc;

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
                "SKIP resume snapshot integration tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database whose name contains _test"
            );
            None
        }
    }

    async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(database_url)
            .await
            .expect("connect to test database for resume snapshot integration tests");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations for resume snapshot integration tests");
        pool
    }

    async fn seed_user(pool: &sqlx::PgPool) -> User {
        let user_id = Uuid::new_v4();
        let workos_id = format!("workos_snapshot_{user_id}");

        sqlx::query("INSERT INTO users (id, workos_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(&workos_id)
            .execute(pool)
            .await
            .expect("insert user");

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .expect("fetch user")
    }

    async fn seed_resume(pool: &sqlx::PgPool, user_id: Uuid, data: serde_json::Value) -> ResumeRow {
        sqlx::query_as::<_, ResumeRow>(
            r#"
            INSERT INTO resumes (user_id, title, data)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
            "#,
        )
        .bind(user_id)
        .bind("Snapshot Test")
        .bind(data)
        .fetch_one(pool)
        .await
        .expect("insert resume")
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

    fn sample_data(label: &str) -> serde_json::Value {
        serde_json::json!({
            "basics": {
                "name": label
            }
        })
    }

    #[test]
    fn looks_like_test_database_url_matches_database_name_only() {
        assert!(looks_like_test_database_url(
            "postgres://user:pass@localhost:5432/rustume_test"
        ));
        assert!(!looks_like_test_database_url(
            "postgres://user:pass@localhost:5432/rustume"
        ));
    }

    #[tokio::test]
    async fn update_resume_creates_snapshot_with_new_version() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("v1")).await;
        let state = test_app_state(pool.clone());

        let updated = update_resume(
            AuthUser(user.clone()),
            State(state),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("v2")),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("update resume")
        .0;

        let snapshot_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM resume_snapshots WHERE resume_id = $1 AND version = $2",
        )
        .bind(resume.id)
        .bind(updated.version)
        .fetch_one(&pool)
        .await
        .expect("count snapshots");

        cleanup_user(&pool, user.id).await;

        assert_eq!(updated.version, resume.version + 1);
        assert_eq!(snapshot_count, 1);
    }

    #[tokio::test]
    async fn list_resume_versions_returns_newest_first_without_payloads() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("v1")).await;
        let state = test_app_state(pool.clone());

        let first = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("v2")),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("first update")
        .0;

        let second = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("v3")),
                version: Some(first.version),
            }),
        )
        .await
        .expect("second update")
        .0;

        let versions = list_resume_versions(AuthUser(user.clone()), State(state), Path(resume.id))
            .await
            .expect("list versions")
            .0;

        cleanup_user(&pool, user.id).await;

        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].version, second.version);
        assert_eq!(versions[1].version, first.version);
        let json = serde_json::to_value(&versions).expect("serialize versions");
        assert!(json.as_array().unwrap()[0].get("data").is_none());
    }

    #[tokio::test]
    async fn get_resume_version_returns_stored_data() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("v1")).await;
        let state = test_app_state(pool.clone());
        let expected = sample_data("stored");

        let updated = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(expected.clone()),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("update resume")
        .0;

        let snapshot = get_resume_version(
            AuthUser(user.clone()),
            State(state),
            Path((resume.id, updated.version)),
        )
        .await
        .expect("get version")
        .0;

        cleanup_user(&pool, user.id).await;

        assert_eq!(snapshot.version, updated.version);
        assert_eq!(snapshot.data, expected);
    }

    #[tokio::test]
    async fn restore_resume_version_bumps_version_and_adds_snapshot() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("current")).await;
        let state = test_app_state(pool.clone());
        let historical = sample_data("historical");

        let updated = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(historical.clone()),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("seed historical snapshot")
        .0;

        let advanced = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("newer")),
                version: Some(updated.version),
            }),
        )
        .await
        .expect("advance current state")
        .0;

        let restored = restore_resume_version(
            AuthUser(user.clone()),
            State(state),
            Path((resume.id, updated.version)),
            Json(RestoreResumeRequest {
                version: advanced.version,
            }),
        )
        .await
        .expect("restore version")
        .0;

        let snapshot_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM resume_snapshots WHERE resume_id = $1")
                .bind(resume.id)
                .fetch_one(&pool)
                .await
                .expect("count snapshots");

        cleanup_user(&pool, user.id).await;

        assert_eq!(restored.version, advanced.version + 1);
        assert_eq!(restored.data, historical);
        assert_eq!(snapshot_count, 3);
    }

    #[tokio::test]
    async fn restore_resume_version_rejects_stale_expected_version() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("current")).await;
        let state = test_app_state(pool.clone());

        let updated = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("historical")),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("seed historical snapshot")
        .0;

        let _ = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("newer")),
                version: Some(updated.version),
            }),
        )
        .await
        .expect("advance current state");

        let restore_result = restore_resume_version(
            AuthUser(user.clone()),
            State(state),
            Path((resume.id, updated.version)),
            Json(RestoreResumeRequest {
                version: updated.version,
            }),
        )
        .await;

        cleanup_user(&pool, user.id).await;

        assert!(matches!(
            restore_result,
            Err(err) if matches!(err.kind, ApiErrorKind::Conflict)
                && err.current_version == Some(updated.version + 1)
        ));
    }

    #[tokio::test]
    async fn prune_resume_snapshots_caps_at_fifty() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("start")).await;
        let state = test_app_state(pool.clone());
        let mut current_version = resume.version;

        for index in 0..=MAX_SNAPSHOTS_PER_RESUME {
            let updated = update_resume(
                AuthUser(user.clone()),
                State(state.clone()),
                Path(resume.id),
                Json(UpdateResumeRequest {
                    title: None,
                    data: Some(sample_data(&format!("v{index}"))),
                    version: Some(current_version),
                }),
            )
            .await
            .expect("update resume")
            .0;
            current_version = updated.version;
        }

        let snapshot_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM resume_snapshots WHERE resume_id = $1")
                .bind(resume.id)
                .fetch_one(&pool)
                .await
                .expect("count snapshots");

        cleanup_user(&pool, user.id).await;

        assert_eq!(snapshot_count, MAX_SNAPSHOTS_PER_RESUME);
    }

    #[tokio::test]
    async fn cross_user_resume_version_access_returns_not_found() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let owner = seed_user(&pool).await;
        let other = seed_user(&pool).await;
        let resume = seed_resume(&pool, owner.id, sample_data("private")).await;
        let owner_state = test_app_state(pool.clone());
        let other_state = test_app_state(pool.clone());

        let updated = update_resume(
            AuthUser(owner.clone()),
            State(owner_state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("private-v2")),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("owner update")
        .0;

        let list_result = list_resume_versions(
            AuthUser(other.clone()),
            State(other_state.clone()),
            Path(resume.id),
        )
        .await;
        let get_result = get_resume_version(
            AuthUser(other.clone()),
            State(other_state.clone()),
            Path((resume.id, updated.version)),
        )
        .await;
        let restore_result = restore_resume_version(
            AuthUser(other.clone()),
            State(other_state),
            Path((resume.id, updated.version)),
            Json(RestoreResumeRequest {
                version: updated.version,
            }),
        )
        .await;

        cleanup_user(&pool, owner.id).await;
        cleanup_user(&pool, other.id).await;

        assert!(matches!(
            list_result,
            Err(err) if matches!(err.kind, ApiErrorKind::NotFound)
        ));
        assert!(matches!(
            get_result,
            Err(err) if matches!(err.kind, ApiErrorKind::NotFound)
        ));
        assert!(matches!(
            restore_result,
            Err(err) if matches!(err.kind, ApiErrorKind::NotFound)
        ));
    }

    #[tokio::test]
    async fn deleting_resume_cascades_snapshots() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let user = seed_user(&pool).await;
        let resume = seed_resume(&pool, user.id, sample_data("v1")).await;
        let state = test_app_state(pool.clone());

        let _ = update_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Path(resume.id),
            Json(UpdateResumeRequest {
                title: None,
                data: Some(sample_data("v2")),
                version: Some(resume.version),
            }),
        )
        .await
        .expect("create snapshot");

        delete_resume(
            AuthUser(user.clone()),
            State(state),
            Path(resume.id),
            axum::http::HeaderMap::new(),
        )
        .await
        .expect("delete resume");

        let snapshot_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM resume_snapshots WHERE resume_id = $1")
                .bind(resume.id)
                .fetch_one(&pool)
                .await
                .expect("count snapshots");

        cleanup_user(&pool, user.id).await;

        assert_eq!(snapshot_count, 0);
    }
}
