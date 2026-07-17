//! Resume CRUD routes backed by persistent server-side storage.
//!
//! Available in both self-hosted mode (implicit local user, no auth) and
//! cloud mode (session-cookie auth). Payloads are encrypted at rest when
//! `RUSTUME_ENCRYPT_AT_REST` is enabled.

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
    StoredResumeRow, UpdateResumeRequest,
};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::net::{self, trusted_client_ip};
use crate::state::AppState;
use crate::storage::{EncodedResumeData, StorageState};
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
    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
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
    .fetch_one(&storage.db)
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
    .fetch_all(&storage.db)
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
    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
    access.ensure_read()?;
    fetch_owned_resume(storage, user.id, id).await.map(Json)
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
    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
    access.ensure_write()?;
    let title = body.title.unwrap_or_else(|| "Untitled".to_string());
    validate_title(title.as_str())?;
    validate_resume_json(&body.data)?;
    let resume_id = body.id.unwrap_or_else(Uuid::new_v4);
    let payload = storage.encode_resume_data(body.data, resume_id)?;

    let row = sqlx::query_as::<_, StoredResumeRow>(
        r#"
        INSERT INTO resumes (id, user_id, title, data, data_encrypted)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(resume_id)
    .bind(user.id)
    .bind(title)
    .bind(payload.data)
    .bind(payload.data_encrypted)
    .fetch_one(&storage.db)
    .await
    .map_err(map_resume_db_error)?;

    Ok((StatusCode::CREATED, Json(storage.decode_resume_row(row)?)))
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

    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
    access.ensure_write()?;
    let existing = fetch_owned_resume(storage, user.id, id).await?;
    let title = body.title.unwrap_or(existing.title);
    validate_title(title.as_str())?;
    if let Some(data) = &body.data {
        validate_resume_json(data)?;
    }
    let payload = body
        .data
        .map(|data| storage.encode_resume_data(data, id))
        .transpose()?;

    let row = apply_resume_update(storage, user.id, id, &title, payload, body.version).await?;

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
    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
    access.ensure_delete()?;
    let result = sqlx::query("DELETE FROM resumes WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user.id)
        .execute(&storage.db)
        .await
        .map_err(internal_db_error)?;

    if result.rows_affected() == 0 {
        return Err(ApiError::not_found("Resume not found"));
    }

    record_event(
        &storage.db,
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

/// Import browser-stored resumes into the authenticated user's server storage.
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

    let storage = state.storage()?;
    let access = subscription::load_access(&storage.db, user.id).await?;
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
        match import_single_resume(storage, user.id, item).await {
            Ok(row) => imported.push(ResumeSummary::from(row)),
            Err(err) => failed.push(ImportFailure {
                id: resume_id,
                error: err.error,
            }),
        }
    }

    record_event(
        &storage.db,
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
    storage: &StorageState,
    user_id: Uuid,
    item: ImportResumeItem,
) -> Result<ResumeRow, ApiError> {
    let title = item.title.unwrap_or_else(|| "Untitled".to_string());
    let resume_id = item.id.unwrap_or_else(Uuid::new_v4);
    let payload = storage.encode_resume_data(item.data, resume_id)?;

    let row = sqlx::query_as::<_, StoredResumeRow>(
        r#"
        INSERT INTO resumes (id, user_id, title, data, data_encrypted)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            data = EXCLUDED.data,
            data_encrypted = EXCLUDED.data_encrypted,
            updated_at = now()
        WHERE resumes.user_id = EXCLUDED.user_id
        RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
        "#,
    )
    .bind(resume_id)
    .bind(user_id)
    .bind(title)
    .bind(payload.data)
    .bind(payload.data_encrypted)
    .fetch_one(&storage.db)
    .await
    .map_err(|err| map_import_db_error(err, resume_id))?;

    storage.decode_resume_row(row)
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
    storage: &StorageState,
    user_id: Uuid,
    resume_id: Uuid,
    title: &str,
    payload: Option<EncodedResumeData>,
    expected_version: Option<i32>,
) -> Result<ResumeRow, ApiError> {
    let row = match (payload, expected_version) {
        (Some(payload), Some(version)) => {
            sqlx::query_as::<_, StoredResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    data = $2,
                    data_encrypted = $3,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $4 AND user_id = $5 AND version = $6
                RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(payload.data)
            .bind(payload.data_encrypted)
            .bind(resume_id)
            .bind(user_id)
            .bind(version)
            .fetch_optional(&storage.db)
            .await
        }
        (Some(payload), None) => {
            sqlx::query_as::<_, StoredResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    data = $2,
                    data_encrypted = $3,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $4 AND user_id = $5
                RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(payload.data)
            .bind(payload.data_encrypted)
            .bind(resume_id)
            .bind(user_id)
            .fetch_optional(&storage.db)
            .await
        }
        (None, Some(version)) => {
            sqlx::query_as::<_, StoredResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $2 AND user_id = $3 AND version = $4
                RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(resume_id)
            .bind(user_id)
            .bind(version)
            .fetch_optional(&storage.db)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, StoredResumeRow>(
                r#"
                UPDATE resumes
                SET title = $1,
                    version = version + 1,
                    updated_at = now()
                WHERE id = $2 AND user_id = $3
                RETURNING id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
                "#,
            )
            .bind(title)
            .bind(resume_id)
            .bind(user_id)
            .fetch_optional(&storage.db)
            .await
        }
    }
    .map_err(map_resume_db_error)?;

    match row {
        Some(row) => storage.decode_resume_row(row),
        None => map_update_miss(&storage.db, user_id, resume_id, expected_version).await,
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
    storage: &StorageState,
    user_id: Uuid,
    resume_id: Uuid,
) -> Result<ResumeRow, ApiError> {
    let row = sqlx::query_as::<_, StoredResumeRow>(
        r#"
        SELECT id, user_id, title, data, data_encrypted, is_public, public_slug, password_hash, version, created_at, updated_at
        FROM resumes
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(resume_id)
    .bind(user_id)
    .fetch_optional(&storage.db)
    .await
    .map_err(internal_db_error)?
    .ok_or_else(|| ApiError::not_found("Resume not found"))?;

    storage.decode_resume_row(row)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use crate::storage::LOCAL_USER_ID;
    use crate::test_support::{connect_test_pool, database_url_for_tests, storage_state};
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    async fn cleanup_local_resume(pool: &sqlx::PgPool, id: Uuid) {
        sqlx::query("DELETE FROM resumes WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await
            .expect("cleanup resume");
    }

    fn local_state(pool: sqlx::PgPool, encrypt_at_rest: bool) -> AppState {
        AppState::with_require_auth(
            std::sync::Arc::new(crate::routes::static_dir()),
            Some(storage_state(pool, encrypt_at_rest)),
            None,
            false,
        )
    }

    fn sample_resume_data() -> serde_json::Value {
        serde_json::json!({"basics": {"name": "Ada Lovelace"}})
    }

    #[tokio::test]
    async fn create_resume_encrypts_payload_at_rest() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let state = local_state(pool.clone(), true);
        let user = state
            .storage()
            .expect("storage")
            .local_user()
            .await
            .expect("local user");
        let resume_id = Uuid::new_v4();

        let (status, Json(row)) = create_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Json(CreateResumeRequest {
                id: Some(resume_id),
                title: Some("Encrypted".to_string()),
                data: sample_resume_data(),
            }),
        )
        .await
        .expect("create resume");

        assert_eq!(status, StatusCode::CREATED);
        assert_eq!(row.data, sample_resume_data());

        let (data, data_encrypted) =
            sqlx::query_as::<_, (Option<serde_json::Value>, Option<Vec<u8>>)>(
                "SELECT data, data_encrypted FROM resumes WHERE id = $1",
            )
            .bind(resume_id)
            .fetch_one(&pool)
            .await
            .expect("fetch raw row");

        assert!(data.is_none(), "plaintext column must be NULL");
        let blob = data_encrypted.expect("encrypted column must be set");
        assert!(
            !blob.windows(3).any(|w| w == b"Ada"),
            "blob must not leak plaintext"
        );

        let fetched = get_resume(AuthUser(user), State(state), Path(resume_id))
            .await
            .expect("get resume");
        assert_eq!(fetched.0.data, sample_resume_data());

        cleanup_local_resume(&pool, resume_id).await;
    }

    #[tokio::test]
    async fn update_resume_reencrypts_payload() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let state = local_state(pool.clone(), true);
        let user = state
            .storage()
            .expect("storage")
            .local_user()
            .await
            .expect("local user");
        let resume_id = Uuid::new_v4();

        let (created_status, _created) = create_resume(
            AuthUser(user.clone()),
            State(state.clone()),
            Json(CreateResumeRequest {
                id: Some(resume_id),
                title: Some("Original".to_string()),
                data: sample_resume_data(),
            }),
        )
        .await
        .expect("create resume");
        assert_eq!(created_status, StatusCode::CREATED);

        let updated_data = serde_json::json!({"basics": {"name": "Grace Hopper"}});
        let updated = update_resume(
            AuthUser(user),
            State(state),
            Path(resume_id),
            Json(UpdateResumeRequest {
                title: Some("Updated".to_string()),
                data: Some(updated_data.clone()),
                version: Some(1),
            }),
        )
        .await
        .expect("update resume");

        assert_eq!(updated.0.data, updated_data);
        assert_eq!(updated.0.version, 2);

        cleanup_local_resume(&pool, resume_id).await;
    }

    #[tokio::test]
    async fn local_mode_resume_crud_without_cookies() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let app = crate::app::create_router_with_state(local_state(pool.clone(), true));
        let resume_id = Uuid::new_v4();

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/resumes")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::json!({
                            "id": resume_id,
                            "title": "Local resume",
                            "data": sample_resume_data(),
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::CREATED,
            "local mode create must not require auth"
        );

        let owner = sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM resumes WHERE id = $1")
            .bind(resume_id)
            .fetch_one(&pool)
            .await
            .expect("fetch owner");
        assert_eq!(
            owner, LOCAL_USER_ID,
            "resume must belong to the seeded local user"
        );

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/resumes/{resume_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/resumes/{resume_id}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn auth_me_reports_local_mode() {
        let Some(database_url) = database_url_for_tests() else {
            return;
        };
        let pool = connect_test_pool(&database_url).await;
        let app = crate::app::create_router_with_state(local_state(pool, true));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/auth/me")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(payload["mode"], "local");
        assert_eq!(payload["id"], LOCAL_USER_ID.to_string());
        assert_eq!(payload["plan"], "self-hosted");
        assert_eq!(payload["require_auth"], false);
    }
}
