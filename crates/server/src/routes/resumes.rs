use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::db::{
    CreateResumeRequest, ImportResumesRequest, ResumeRow, ResumeSummary, UpdateResumeRequest,
};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

pub async fn list_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ResumeSummary>>, ApiError> {
    let cloud = state.cloud()?;
    let rows = sqlx::query_as::<_, ResumeRow>(
        r#"
        SELECT id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user.id)
    .fetch_all(&cloud.db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

    Ok(Json(rows.into_iter().map(ResumeSummary::from).collect()))
}

pub async fn get_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ResumeRow>, ApiError> {
    fetch_owned_resume(&state, user.id, id).await.map(Json)
}

pub async fn create_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<CreateResumeRequest>,
) -> Result<(StatusCode, Json<ResumeRow>), ApiError> {
    let cloud = state.cloud()?;
    let title = body.title.unwrap_or_else(|| "Untitled".to_string());

    let row = sqlx::query_as::<_, ResumeRow>(
        r#"
        INSERT INTO resumes (user_id, title, data)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(user.id)
    .bind(title)
    .bind(body.data)
    .fetch_one(&cloud.db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn update_resume(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateResumeRequest>,
) -> Result<Json<ResumeRow>, ApiError> {
    let cloud = state.cloud()?;
    let _existing = fetch_owned_resume(&state, user.id, id).await?;

    let title = body.title.unwrap_or_else(|| _existing.title.clone());

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
    .map_err(|err| ApiError::internal(err.to_string()))?;

    Ok(Json(row))
}

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
        .map_err(|err| ApiError::internal(err.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Resume not found"));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn import_resumes(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(body): Json<ImportResumesRequest>,
) -> Result<Json<Vec<ResumeSummary>>, ApiError> {
    let cloud = state.cloud()?;
    let mut imported = Vec::new();

    for item in body.resumes {
        let title = item.title.unwrap_or_else(|| "Untitled".to_string());
        let row = sqlx::query_as::<_, ResumeRow>(
            r#"
            INSERT INTO resumes (user_id, title, data)
            VALUES ($1, $2, $3)
            RETURNING id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
            "#,
        )
        .bind(user.id)
        .bind(title)
        .bind(item.data)
        .fetch_one(&cloud.db)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
        imported.push(ResumeSummary::from(row));
    }

    Ok(Json(imported))
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
    .map_err(|err| ApiError::internal(err.to_string()))?
    .ok_or_else(|| ApiError::not_found("Resume not found"))
}
