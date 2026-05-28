use axum::{
    extract::State,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use rustume_render::Renderer;
use rustume_schema::ResumeData;
use validator::Validate;

use crate::dto::{RenderPdfRequest, RenderPreviewRequest};
use crate::error::ApiError;
use crate::routes::validate::validation_errors;
use crate::state::AppState;

/// Deserialize resume JSON, apply an optional template override, and validate.
fn prepare_resume(
    resume: serde_json::Value,
    template: Option<String>,
) -> Result<ResumeData, ApiError> {
    let mut resume: ResumeData =
        serde_json::from_value(resume).map_err(|_| ApiError::new("Invalid resume data format"))?;

    if let Some(template) = template {
        resume.metadata.template = template;
    }

    resume
        .validate()
        .map_err(|e| ApiError::with_details("Validation failed", validation_errors(&e)))?;

    Ok(resume)
}

/// Render resume to PDF
///
/// Generates a PDF document from the provided resume data using the specified template.
#[utoipa::path(
    post,
    path = "/api/render/pdf",
    tag = "Render",
    request_body = RenderPdfRequest,
    responses(
        (status = 200, description = "PDF document", content_type = "application/pdf"),
        (status = 400, description = "Failed to render PDF", body = ApiError)
    )
)]
pub async fn render_pdf(
    State(state): State<AppState>,
    Json(req): Json<RenderPdfRequest>,
) -> Result<Response, ApiError> {
    let resume = prepare_resume(req.resume, req.template)?;
    let renderer = state.renderer.clone();

    let pdf = tokio::task::spawn_blocking(move || {
        renderer
            .render_pdf(&resume)
            .map_err(|err| format!("Failed to render PDF: {err}"))
    })
    .await
    .map_err(|err| ApiError::internal(format!("Render task failed: {err}")))?
    .map_err(ApiError::internal)?;

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/pdf")],
        pdf,
    )
        .into_response())
}

/// Render resume to PNG preview
///
/// Generates a PNG image preview of a specific page from the resume.
#[utoipa::path(
    post,
    path = "/api/render/preview",
    tag = "Render",
    request_body = RenderPreviewRequest,
    responses(
        (status = 200, description = "PNG image preview", content_type = "image/png"),
        (status = 400, description = "Failed to render preview", body = ApiError)
    )
)]
pub async fn render_preview(
    State(state): State<AppState>,
    Json(req): Json<RenderPreviewRequest>,
) -> Result<Response, ApiError> {
    let resume = prepare_resume(req.resume, req.template)?;
    let page = req.page;
    let renderer = state.renderer.clone();

    let (png, total_pages) = tokio::task::spawn_blocking(move || {
        renderer
            .render_preview(&resume, page)
            .map_err(|err| format!("Failed to render preview: {err}"))
    })
    .await
    .map_err(|err| ApiError::internal(format!("Render task failed: {err}")))?
    .map_err(ApiError::internal)?;

    let mut response = (StatusCode::OK, [(header::CONTENT_TYPE, "image/png")], png).into_response();
    let total_pages_header = HeaderValue::from_str(&total_pages.to_string())
        .map_err(|err| ApiError::internal(format!("invalid X-Total-Pages header: {err}")))?;
    response
        .headers_mut()
        .insert("X-Total-Pages", total_pages_header);
    Ok(response)
}
