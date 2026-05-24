use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use rustume_render::{Renderer, TypstRenderer};
use rustume_schema::ResumeData;
use validator::Validate;

use crate::dto::{RenderPdfRequest, RenderPreviewRequest};
use crate::error::ApiError;
use crate::routes::validate::validation_errors;

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
pub async fn render_pdf(Json(req): Json<RenderPdfRequest>) -> Result<Response, ApiError> {
    let mut resume: ResumeData = serde_json::from_value(req.resume)
        .map_err(|e| ApiError::new(format!("Invalid resume data: {}", e)))?;

    // Set template if provided
    if let Some(template) = req.template {
        resume.metadata.template = template;
    }

    // Validate
    resume
        .validate()
        .map_err(|e| ApiError::with_details("Validation failed", validation_errors(&e)))?;

    // Render
    let renderer = TypstRenderer::new();
    let pdf = renderer
        .render_pdf(&resume)
        .map_err(|e| ApiError::internal(format!("Failed to render PDF: {}", e)))?;

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
pub async fn render_preview(Json(req): Json<RenderPreviewRequest>) -> Result<Response, ApiError> {
    let mut resume: ResumeData = serde_json::from_value(req.resume)
        .map_err(|e| ApiError::new(format!("Invalid resume data: {}", e)))?;

    // Set template if provided
    if let Some(template) = req.template {
        resume.metadata.template = template;
    }

    // Validate
    resume
        .validate()
        .map_err(|e| ApiError::with_details("Validation failed", validation_errors(&e)))?;

    // Render
    let renderer = TypstRenderer::new();
    let (png, total_pages) = renderer
        .render_preview(&resume, req.page)
        .map_err(|e| ApiError::internal(format!("Failed to render preview: {}", e)))?;

    let mut response = (StatusCode::OK, [(header::CONTENT_TYPE, "image/png")], png).into_response();
    let total_pages_header = HeaderValue::from_str(&total_pages.to_string())
        .map_err(|err| ApiError::internal(format!("invalid X-Total-Pages header: {err}")))?;
    response
        .headers_mut()
        .insert("X-Total-Pages", total_pages_header);
    Ok(response)
}
