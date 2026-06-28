//! Bulk resume export routes for Rustume Cloud data portability.

use axum::{
    extract::State,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use rustume_render::Renderer;
use rustume_schema::ResumeData;
use tracing::error;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::db::{ResumeBulkExport, ResumeExportItem};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use crate::subscription;

const MAX_EXPORT_RESUMES: i64 = 50;

/// Reject bulk export when the owned resume count exceeds the cap.
fn reject_export_over_resume_cap() -> ApiError {
    ApiError::payload_too_large(format!(
        "Export exceeds maximum of {MAX_EXPORT_RESUMES} resumes"
    ))
}

/// Returns `Ok(())` when `count` is within the export cap (for unit tests).
fn ensure_export_resume_count(count: i64) -> Result<(), ApiError> {
    if count > MAX_EXPORT_RESUMES {
        return Err(reject_export_over_resume_cap());
    }
    Ok(())
}

/// Resume fields required for bulk export.
#[derive(Debug, sqlx::FromRow)]
struct ExportResumeRow {
    id: Uuid,
    title: String,
    data: serde_json::Value,
}

/// Export all resumes for the authenticated user as JSON.
#[utoipa::path(
    get,
    path = "/api/resumes/export",
    tag = "Resumes",
    responses(
        (status = 200, description = "Bulk JSON export", body = ResumeBulkExport),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 403, description = "Subscription expired", body = ApiError),
        (status = 413, description = "Too many resumes to export", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn export_resumes_json(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Json<ResumeBulkExport>, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_export()?;

    let rows = fetch_all_resumes(&cloud.db, user.id).await?;
    let resumes = rows
        .into_iter()
        .map(|row| ResumeExportItem {
            id: row.id,
            title: row.title,
            data: row.data,
        })
        .collect();

    Ok(Json(ResumeBulkExport {
        exported_at: Utc::now(),
        resumes,
    }))
}

/// Export all resumes for the authenticated user as a ZIP of PDF files.
#[utoipa::path(
    get,
    path = "/api/resumes/export/pdf",
    tag = "Resumes",
    responses(
        (status = 200, description = "ZIP archive of PDF resumes", content_type = "application/zip"),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 403, description = "Subscription expired", body = ApiError),
        (status = 413, description = "Too many resumes to export", body = ApiError),
    ),
    security(("cookieAuth" = []))
)]
pub async fn export_resumes_pdf(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> Result<Response, ApiError> {
    let cloud = state.cloud()?;
    let access = subscription::load_access(&cloud.db, user.id).await?;
    access.ensure_export()?;

    let rows = fetch_all_resumes(&cloud.db, user.id).await?;
    let renderer = state.renderer.clone();
    let mut archive = ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for row in rows {
        let resume: ResumeData = serde_json::from_value(row.data)
            .map_err(|_| ApiError::new("Invalid resume data format"))?;
        let file_name = export_pdf_filename(&row.id, &row.title);
        let pdf = tokio::task::spawn_blocking({
            let renderer = renderer.clone();
            let resume = resume.clone();
            let resume_id = row.id;
            let resume_title = row.title.clone();
            move || {
                renderer.render_pdf(&resume).map_err(|err| {
                    format!("Failed to render PDF for resume '{resume_title}' ({resume_id}): {err}")
                })
            }
        })
        .await
        .map_err(|err| ApiError::internal(format!("Render task failed: {err}")))?
        .map_err(ApiError::internal)?;

        archive
            .start_file(file_name, options)
            .map_err(|err| ApiError::internal(format!("Failed to create ZIP entry: {err}")))?;
        std::io::Write::write_all(&mut archive, &pdf)
            .map_err(|err| ApiError::internal(format!("Failed to write ZIP entry: {err}")))?;
    }

    let cursor = archive
        .finish()
        .map_err(|err| ApiError::internal(format!("Failed to finalize ZIP: {err}")))?;
    let bytes = cursor.into_inner();

    let content_disposition =
        HeaderValue::from_static("attachment; filename=\"rustume-resumes.zip\"");
    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/zip"),
            ),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        bytes,
    )
        .into_response())
}

async fn fetch_all_resumes(
    db: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<Vec<ExportResumeRow>, ApiError> {
    let fetch_limit = MAX_EXPORT_RESUMES + 1;
    let rows = sqlx::query_as::<_, ExportResumeRow>(
        r#"
        SELECT id, title, data
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(fetch_limit)
    .fetch_all(db)
    .await
    .map_err(internal_db_error)?;

    if rows.len() as i64 > MAX_EXPORT_RESUMES {
        return Err(reject_export_over_resume_cap());
    }

    Ok(rows)
}

fn internal_db_error(err: impl std::fmt::Display) -> ApiError {
    error!("export resume query failed: {err}");
    ApiError::internal("internal server error")
}

fn export_pdf_filename(id: &Uuid, title: &str) -> String {
    let slug: String = title
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else if ch.is_whitespace() || ch == '-' || ch == '_' {
                '-'
            } else {
                '_'
            }
        })
        .collect();
    let slug = slug.trim_matches(|c| c == '-' || c == '_');
    let slug = if slug.chars().any(|ch| ch.is_ascii_alphanumeric()) {
        slug.to_string()
    } else {
        "resume".to_string()
    };
    format!("{slug}-{id}.pdf")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::{session::SessionService, workos::WorkOsClient};
    use crate::cloud::CloudState;
    use crate::email::EmailService;
    use crate::error::ApiErrorKind;
    use crate::state::AppState;
    use sqlx::postgres::PgPoolOptions;
    use std::sync::Arc;

    #[test]
    fn ensure_export_resume_count_allows_fifty() {
        assert!(ensure_export_resume_count(50).is_ok());
    }

    #[test]
    fn ensure_export_resume_count_rejects_fifty_one() {
        let err = ensure_export_resume_count(51).expect_err("expected cap rejection");
        assert!(matches!(err.kind, ApiErrorKind::PayloadTooLarge));
        assert!(err.error.contains("50"));
        assert!(!err.error.contains("51"));
    }

    fn looks_like_test_database_url(url: &str) -> bool {
        url.contains("_test")
    }

    fn database_url_for_tests() -> Option<String> {
        let url = std::env::var("TEST_DATABASE_URL")
            .or_else(|_| std::env::var("DATABASE_URL"))
            .ok()
            .map(|url| url.trim().to_owned())
            .filter(|url| !url.is_empty())?;

        if looks_like_test_database_url(&url) {
            Some(url)
        } else {
            eprintln!(
                "SKIP export integration tests: set TEST_DATABASE_URL (or DATABASE_URL) to a database whose name contains _test"
            );
            None
        }
    }

    async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(database_url)
            .await
            .expect("connect to test database for export integration tests");
        sqlx::migrate!("./src/db/migrations")
            .run(&pool)
            .await
            .expect("run migrations for export integration tests");
        pool
    }

    async fn seed_user_with_resumes(pool: &sqlx::PgPool, count: i64) -> crate::db::User {
        let user_id = Uuid::new_v4();
        let workos_id = format!("workos_export_cap_{user_id}");

        sqlx::query("INSERT INTO users (id, workos_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(&workos_id)
            .execute(pool)
            .await
            .expect("insert user");

        for index in 0..count {
            sqlx::query("INSERT INTO resumes (user_id, title, data) VALUES ($1, $2, $3)")
                .bind(user_id)
                .bind(format!("Resume {index}"))
                .bind(serde_json::json!({}))
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

    #[tokio::test]
    async fn export_resumes_json_rejects_over_fifty_resumes_with_413() {
        let Some(database_url) = database_url_for_tests() else {
            eprintln!("SKIP export_resumes_json cap test: DATABASE_URL unavailable");
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 51).await;
        let state = test_app_state(pool.clone());

        let result = export_resumes_json(AuthUser(user.clone()), State(state)).await;
        cleanup_user(&pool, user.id).await;

        assert!(matches!(
            result,
            Err(err) if matches!(err.kind, ApiErrorKind::PayloadTooLarge)
        ));
    }

    #[tokio::test]
    async fn export_resumes_json_returns_all_resumes_at_fifty() {
        let Some(database_url) = database_url_for_tests() else {
            eprintln!("SKIP export_resumes_json at-cap test: DATABASE_URL unavailable");
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 50).await;
        let state = test_app_state(pool.clone());

        let result = export_resumes_json(AuthUser(user.clone()), State(state)).await;
        cleanup_user(&pool, user.id).await;

        let payload = result.expect("expected bulk JSON export to succeed at cap");
        assert_eq!(payload.resumes.len(), 50);
    }

    #[tokio::test]
    async fn export_resumes_pdf_rejects_over_fifty_resumes_with_413() {
        let Some(database_url) = database_url_for_tests() else {
            eprintln!("SKIP export_resumes_pdf cap test: DATABASE_URL unavailable");
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 51).await;
        let state = test_app_state(pool.clone());

        let result = export_resumes_pdf(AuthUser(user.clone()), State(state)).await;
        cleanup_user(&pool, user.id).await;

        assert!(matches!(
            result,
            Err(err) if matches!(err.kind, ApiErrorKind::PayloadTooLarge)
        ));
    }

    #[tokio::test]
    async fn export_resumes_pdf_returns_zip_at_fifty() {
        let Some(database_url) = database_url_for_tests() else {
            eprintln!("SKIP export_resumes_pdf at-cap test: DATABASE_URL unavailable");
            return;
        };
        let pool = connect_test_pool(&database_url).await;

        let user = seed_user_with_resumes(&pool, 50).await;
        let state = test_app_state(pool.clone());

        let result = export_resumes_pdf(AuthUser(user.clone()), State(state)).await;
        cleanup_user(&pool, user.id).await;

        let response = result.expect("expected bulk PDF export to succeed at cap");
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "application/zip",
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read bulk PDF export body");
        assert!(
            body.starts_with(b"PK"),
            "expected ZIP archive bytes at cap boundary",
        );
    }

    #[test]
    fn export_pdf_filename_sanitizes_title() {
        let id = Uuid::nil();
        assert_eq!(
            export_pdf_filename(&id, "Senior Engineer / Lead"),
            format!("senior-engineer-_-lead-{id}.pdf")
        );
    }

    #[test]
    fn export_pdf_filename_falls_back_when_title_empty() {
        let id = Uuid::nil();
        assert_eq!(export_pdf_filename(&id, "   "), format!("resume-{id}.pdf"));
    }

    #[test]
    fn export_pdf_filename_falls_back_for_symbol_only_titles() {
        let id = Uuid::nil();
        assert_eq!(export_pdf_filename(&id, "@@@"), format!("resume-{id}.pdf"));
    }
}
