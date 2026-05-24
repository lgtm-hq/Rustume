use axum::Json;
use rustume_parser::{JsonResumeParser, LinkedInParser, Parser, ReactiveResumeV3Parser};
use rustume_schema::ResumeData;

use crate::dto::{ParseFormat, ParseRequest};
use crate::error::ApiError;

/// Parse resume from various formats
///
/// Converts resumes from JSON Resume, LinkedIn export, Reactive Resume v3,
/// or native Rustume format into the unified Rustume schema.
///
/// For LinkedIn exports, the data must be base64 encoded since it's a ZIP file.
#[utoipa::path(
    post,
    path = "/api/parse",
    tag = "Parse",
    request_body = ParseRequest,
    responses(
        (status = 200, description = "Successfully parsed resume", body = ResumeData),
        (status = 400, description = "Failed to parse resume", body = ApiError)
    )
)]
pub async fn parse(Json(req): Json<ParseRequest>) -> Result<Json<ResumeData>, ApiError> {
    // Decode data
    let data = if req.base64 {
        use base64::Engine;
        base64::engine::general_purpose::STANDARD
            .decode(&req.data)
            .map_err(|e| ApiError::new(format!("Invalid base64: {}", e)))?
    } else {
        req.data.into_bytes()
    };

    // Parse based on format
    let resume = match req.format {
        ParseFormat::JsonResume => JsonResumeParser
            .parse(&data)
            .map_err(|e| ApiError::new(format!("Failed to parse JSON Resume: {}", e)))?,
        ParseFormat::LinkedIn => LinkedInParser
            .parse(&data)
            .map_err(|e| ApiError::new(format!("Failed to parse LinkedIn export: {}", e)))?,
        ParseFormat::Rrv3 => ReactiveResumeV3Parser
            .parse(&data)
            .map_err(|e| ApiError::new(format!("Failed to parse Reactive Resume v3: {}", e)))?,
        ParseFormat::Rustume => serde_json::from_slice(&data)
            .map_err(|e| ApiError::new(format!("Failed to parse Rustume JSON: {}", e)))?,
    };

    Ok(Json(resume))
}
