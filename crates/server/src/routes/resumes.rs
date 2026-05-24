//! Authenticated resume CRUD routes for Rustume Cloud.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use tracing::error;
use uuid::Uuid;

use crate::db::{
    CreateResumeRequest, ImportResumesRequest, ResumeRow, ResumeSummary, UpdateResumeRequest,
};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

/// List resumes for the authenticated user.
#[utoipa::path(
    get,
    path = "/api/resumes",
    tag = "Resumes",
    responses(
        (status = 200, description = "Resume summaries", body = [ResumeSummary]),
        (status = 401, description = "Not authenticated", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn list_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ResumeSummary>>, ApiError> {
    let cloud = state.cloud()?;
    let rows = sqlx::query_as::<_, ResumeSummary>(
        r#"
        SELECT id, title, updated_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(&cloud.db)
    .await
    .map_err(internal_db_error)?;

    Ok(Json(rows))
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
    ),
    security(("cookieAuth" = []))
)]
pub async fn update_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateResumeRequest>,
) -> Result<Json<ResumeRow>, ApiError> {
    let cloud = state.cloud()?;
    let existing = fetch_owned_resume(&state, user.id, id).await?;
    let title = body.title.unwrap_or_else(|| existing.title.clone());

    let row = sqlx::query_as::<_, ResumeRow>(
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
    .bind(body.data)
    .bind(id)
    .bind(user.id)
    .fetch_one(&cloud.db)
    .await
    .map_err(map_resume_db_error)?;

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

    Ok(StatusCode::NO_CONTENT)
}

/// Import local resumes into the authenticated user's cloud account.
#[utoipa::path(
    post,
    path = "/api/resumes/import",
    tag = "Resumes",
    request_body = ImportResumesRequest,
    responses(
        (status = 200, description = "Imported resume summaries", body = [ResumeSummary]),
        (status = 401, description = "Not authenticated", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn import_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ImportResumesRequest>,
) -> Result<Json<Vec<ResumeSummary>>, ApiError> {
    let cloud = state.cloud()?;
    let mut tx = cloud.db.begin().await.map_err(internal_db_error)?;
    let mut imported = Vec::new();

    for item in body.resumes {
        let title = item.title.unwrap_or_else(|| "Untitled".to_string());
        let resume_id = item.id.unwrap_or_else(Uuid::new_v4);
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
        .bind(item.data)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_resume_db_error)?;
        imported.push(ResumeSummary::from(row));
    }

    tx.commit().await.map_err(internal_db_error)?;

    Ok(Json(imported))
}

fn internal_db_error(err: impl std::fmt::Display + Send + Sync + 'static) -> ApiError {
    error!("database error: {err}");
    ApiError::internal("internal server error")
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
