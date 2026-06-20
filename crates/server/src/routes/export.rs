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

use crate::db::{ResumeBulkExport, ResumeExportItem, ResumeRow};
use crate::error::ApiError;
use crate::middleware::auth::AuthUser;
use crate::state::AppState;
use crate::subscription;

/// Export all resumes for the authenticated user as JSON.
#[utoipa::path(
    get,
    path = "/api/resumes/export",
    tag = "Resumes",
    responses(
        (status = 200, description = "Bulk JSON export", body = ResumeBulkExport),
        (status = 401, description = "Not authenticated", body = ApiError),
        (status = 403, description = "Subscription expired", body = ApiError),
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
        let resume: ResumeData = serde_json::from_value(row.data.clone())
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

async fn fetch_all_resumes(db: &sqlx::PgPool, user_id: Uuid) -> Result<Vec<ResumeRow>, ApiError> {
    sqlx::query_as::<_, ResumeRow>(
        r#"
        SELECT id, user_id, title, data, is_public, public_slug, password_hash, version, created_at, updated_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .map_err(|err| {
        error!("export resume query failed: {err}");
        ApiError::internal("internal server error")
    })
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
    let slug = slug.trim_matches('-');
    let slug = if slug.is_empty() {
        "resume".to_string()
    } else {
        slug.to_string()
    };
    format!("{slug}-{id}.pdf")
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
