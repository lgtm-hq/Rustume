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
    CreateResumeRequest, ImportFailure, ImportResumeItem, ImportResumesRequest,
    ImportResumesResponse, PaginatedResumeSummaries, ResumeListQuery, ResumeRow, ResumeSummary,
    UpdateResumeRequest,
};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;
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
    let existing = fetch_owned_resume(&state, user.id, id).await?;
    let title = body.title.unwrap_or(existing.title);
    validate_title(title.as_str())?;
    if let Some(data) = &body.data {
        validate_resume_json(data)?;
    }

    let row = apply_resume_update(&cloud.db, user.id, id, &title, body.data, body.version).await?;

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
    Json(body): Json<ImportResumesRequest>,
) -> Result<Json<ImportResumesResponse>, ApiError> {
    if body.resumes.len() > MAX_IMPORT_BATCH {
        return Err(ApiError::new(format!(
            "Import batch exceeds maximum of {MAX_IMPORT_BATCH} resumes"
        )));
    }

    let cloud = state.cloud()?;
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
            ip_address: None,
        },
    )
    .await;

    Ok(Json(ImportResumesResponse { imported, failed }))
}

struct ImportItemError {
    error: String,
}

async fn import_single_resume(
    db: &sqlx::PgPool,
    user_id: Uuid,
    item: ImportResumeItem,
) -> Result<ResumeRow, ImportItemError> {
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
    .map_err(|err| ImportItemError {
        error: map_import_db_error(err, resume_id).error,
    })
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
            .fetch_optional(db)
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
            .fetch_optional(db)
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
            .fetch_optional(db)
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
            .fetch_optional(db)
            .await
        }
    }
    .map_err(map_resume_db_error)?;

    match row {
        Some(row) => Ok(row),
        None => map_update_miss(db, user_id, resume_id, expected_version).await,
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
