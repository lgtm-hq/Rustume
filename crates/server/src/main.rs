//! Rustume HTTP API Server
//!
//! A REST API for resume parsing, rendering, and validation.
//!
//! # Endpoints
//!
//! - `GET /health` - Health check
//! - `GET /api/templates` - List available templates
//! - `POST /api/parse` - Parse resume from various formats
//! - `POST /api/render/pdf` - Render resume to PDF
//! - `POST /api/render/preview` - Render resume to PNG preview
//! - `POST /api/validate` - Validate resume data
//! - `GET /swagger-ui` - Swagger UI documentation

use anyhow::Context;
use axum::{
    extract::{DefaultBodyLimit, Path},
    http::{header, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rustume_parser::{JsonResumeParser, LinkedInParser, Parser, ReactiveResumeV3Parser};
use rustume_render::{get_template_theme, Renderer, TypstRenderer, TEMPLATES};
use rustume_schema::ResumeData;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::OnceLock;
use tokio::signal;
use tokio::sync::Mutex;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};
use tracing::info;
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;
use validator::Validate;

/// Maximum request body size (10 MB)
const MAX_BODY_SIZE: usize = 10 * 1024 * 1024;

/// Default server port
const DEFAULT_PORT: u16 = 3000;

// ============================================================================
// OpenAPI Documentation
// ============================================================================

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Rustume API",
        version = "0.1.0",
        description = "REST API for resume parsing, rendering, and validation.\n\n## Features\n\n- **Parse**: Import resumes from JSON Resume, LinkedIn exports, or Reactive Resume v3\n- **Render**: Generate PDF or PNG previews of resumes\n- **Validate**: Check resume data against the schema\n- **Templates**: List available resume templates with theme colors",
        license(name = "MIT", url = "https://opensource.org/licenses/MIT"),
        contact(name = "Rustume", url = "https://github.com/lgtm-hq/Rustume")
    ),
    servers(
        (url = "/", description = "Local server")
    ),
    paths(
        health,
        list_templates,
        template_thumbnail,
        parse,
        render_pdf,
        render_preview,
        validate
    ),
    components(
        schemas(
            ApiError,
            ParseFormat,
            ParseRequest,
            RenderPdfRequest,
            RenderPreviewRequest,
            TemplateInfo,
            ThemeInfo,
            ValidationResponse,
            rustume_schema::ResumeData
        )
    ),
    tags(
        (name = "Health", description = "Health check endpoints"),
        (name = "Templates", description = "Template management"),
        (name = "Parse", description = "Resume parsing from various formats"),
        (name = "Render", description = "Resume rendering to PDF/PNG"),
        (name = "Validate", description = "Resume validation")
    )
)]
struct ApiDoc;

// ============================================================================
// Error Handling
// ============================================================================

/// Error kind for mapping to HTTP status codes.
#[derive(Debug, Clone, Copy, Default)]
enum ApiErrorKind {
    /// Bad request (400) - malformed input, invalid format
    #[default]
    BadRequest,
    /// Unprocessable entity (422) - validation errors
    UnprocessableEntity,
    /// Internal server error (500) - rendering failures, etc.
    InternalError,
}

impl ApiErrorKind {
    fn status_code(self) -> StatusCode {
        match self {
            ApiErrorKind::BadRequest => StatusCode::BAD_REQUEST,
            ApiErrorKind::UnprocessableEntity => StatusCode::UNPROCESSABLE_ENTITY,
            ApiErrorKind::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

/// API error response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ApiError {
    /// Error message
    #[schema(example = "Failed to parse JSON Resume")]
    error: String,
    /// Detailed error messages (e.g., validation errors)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = json!(["basics.email: invalid email format"]))]
    details: Option<Vec<String>>,
    /// Error kind for HTTP status mapping (not serialized)
    #[serde(skip)]
    kind: ApiErrorKind,
}

impl ApiError {
    fn new(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::BadRequest,
        }
    }

    fn with_details(error: impl Into<String>, details: Vec<String>) -> Self {
        Self {
            error: error.into(),
            details: Some(details),
            kind: ApiErrorKind::UnprocessableEntity,
        }
    }

    fn internal(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            details: None,
            kind: ApiErrorKind::InternalError,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.kind.status_code(), Json(self)).into_response()
    }
}

// ============================================================================
// Request/Response Types
// ============================================================================

/// Input format for parsing
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
enum ParseFormat {
    /// JSON Resume standard format (https://jsonresume.org)
    JsonResume,
    /// LinkedIn data export ZIP file
    LinkedIn,
    /// Reactive Resume v3 format
    Rrv3,
    /// Native Rustume format
    Rustume,
}

/// Parse request body
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ParseRequest {
    /// Input format to parse
    #[schema(example = "json-resume")]
    format: ParseFormat,
    /// Resume data as string (JSON) or base64-encoded (for binary formats like LinkedIn ZIP)
    #[schema(example = r#"{"basics":{"name":"John Doe","label":"Developer"}}"#)]
    data: String,
    /// Set to true if data is base64 encoded (required for LinkedIn ZIP files)
    #[serde(default)]
    #[schema(example = false)]
    base64: bool,
}

/// Render PDF request body
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct RenderPdfRequest {
    /// Resume data in Rustume format
    resume: serde_json::Value,
    /// Template name (optional, uses resume metadata or 'rhyhorn' default)
    #[serde(default)]
    #[schema(example = "rhyhorn")]
    template: Option<String>,
}

/// Render preview request body
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct RenderPreviewRequest {
    /// Resume data in Rustume format
    resume: serde_json::Value,
    /// Template name (optional)
    #[serde(default)]
    #[schema(example = "rhyhorn")]
    template: Option<String>,
    /// Page number to preview (0-indexed)
    #[serde(default)]
    #[schema(example = 0)]
    page: usize,
}

/// Template information
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct TemplateInfo {
    /// Template identifier (slug)
    #[schema(example = "rhyhorn")]
    id: String,
    /// Display name
    #[schema(example = "Rhyhorn")]
    name: String,
    /// Theme colors for this template
    theme: ThemeInfo,
}

/// Theme colors for a template
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ThemeInfo {
    /// Background color (hex)
    #[schema(example = "#ffffff")]
    background: String,
    /// Text color (hex)
    #[schema(example = "#000000")]
    text: String,
    /// Primary/accent color (hex)
    #[schema(example = "#dc2626")]
    primary: String,
}

/// Validation response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
struct ValidationResponse {
    /// Whether the resume is valid
    #[schema(example = true)]
    valid: bool,
    /// Validation error messages (only present if invalid)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = json!(["basics.email: invalid email format"]))]
    errors: Option<Vec<String>>,
}

// ============================================================================
// Handlers
// ============================================================================

/// Health check
///
/// Returns "ok" if the server is running.
#[utoipa::path(
    get,
    path = "/health",
    tag = "Health",
    responses(
        (status = 200, description = "Server is healthy", body = String, example = "ok")
    )
)]
async fn health() -> &'static str {
    "ok"
}

/// List available templates
///
/// Returns a list of all available resume templates with their theme colors.
#[utoipa::path(
    get,
    path = "/api/templates",
    tag = "Templates",
    responses(
        (status = 200, description = "List of available templates", body = Vec<TemplateInfo>)
    )
)]
async fn list_templates() -> Json<Vec<TemplateInfo>> {
    let templates: Vec<TemplateInfo> = TEMPLATES
        .iter()
        .map(|name| {
            let theme = get_template_theme(name);
            // Capitalize first letter for display name
            let display_name = {
                let mut chars = name.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                }
            };
            TemplateInfo {
                id: name.to_string(),
                name: display_name,
                theme: ThemeInfo {
                    background: theme.background.clone(),
                    text: theme.text.clone(),
                    primary: theme.primary.clone(),
                },
            }
        })
        .collect();

    Json(templates)
}

/// Cache for rendered template thumbnails (keyed by template name)
fn thumbnail_cache() -> &'static Mutex<HashMap<String, Vec<u8>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Vec<u8>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Create a sample resume with realistic placeholder data for thumbnails.
fn create_sample_resume() -> ResumeData {
    use rustume_schema::*;

    let mut resume = ResumeData::default();
    resume.basics.name = "John Doe".to_string();
    resume.basics.headline = "Senior Software Engineer".to_string();
    resume.basics.email = "john@example.com".to_string();
    resume.basics.phone = "+1 (555) 123-4567".to_string();
    resume.basics.location = "San Francisco, CA".to_string();
    resume.basics.url = Url::with_label("Portfolio", "https://johndoe.dev");

    resume.sections.summary = SummarySection::new(
        "Experienced software engineer with 8+ years building scalable web applications. \
         Expert in React, TypeScript, and cloud architecture. Led teams of 5-10 engineers.",
    );

    resume.sections.experience.add_item(
        Experience::new("TechCorp Inc.", "Senior Software Engineer")
            .with_location("San Francisco, CA")
            .with_date("2020 - Present")
            .with_summary(
                "Lead development of core platform serving 2M+ daily active users. \
                 Architected microservices reducing latency by 40%.",
            ),
    );
    resume.sections.experience.add_item(
        Experience::new("StartupXYZ", "Software Engineer")
            .with_location("Remote")
            .with_date("2017 - 2020")
            .with_summary(
                "Built real-time collaboration features from scratch. \
                 Implemented CI/CD pipelines reducing deployment time by 70%.",
            ),
    );

    resume.sections.education.add_item(
        Education::new("Stanford University", "Computer Science")
            .with_study_type("Bachelor of Science")
            .with_date("2013 - 2017")
            .with_score("GPA: 3.9/4.0"),
    );

    resume
        .sections
        .skills
        .add_item(Skill::new("TypeScript / JavaScript").with_level(5));
    resume
        .sections
        .skills
        .add_item(Skill::new("React / Next.js").with_level(5));
    resume
        .sections
        .skills
        .add_item(Skill::new("Node.js / Python").with_level(4));
    resume
        .sections
        .skills
        .add_item(Skill::new("PostgreSQL / Redis").with_level(4));

    resume
        .sections
        .profiles
        .add_item(Profile::new("GitHub", "johndoe").with_url("https://github.com/johndoe"));
    resume
        .sections
        .profiles
        .add_item(Profile::new("LinkedIn", "johndoe").with_url("https://linkedin.com/in/johndoe"));

    resume
}

/// Get template thumbnail
///
/// Returns a pre-rendered PNG thumbnail of the template with sample data.
#[utoipa::path(
    get,
    path = "/api/templates/{id}/thumbnail",
    tag = "Templates",
    params(
        ("id" = String, Path, description = "Template ID")
    ),
    responses(
        (status = 200, description = "PNG thumbnail image", content_type = "image/png"),
        (status = 404, description = "Template not found", body = ApiError)
    )
)]
async fn template_thumbnail(Path(id): Path<String>) -> Result<Response, ApiError> {
    // Verify template exists
    if !TEMPLATES.contains(&id.as_str()) {
        return Err(ApiError::new(format!("Template '{}' not found", id)));
    }

    // Check cache
    {
        let cache = thumbnail_cache().lock().await;
        if let Some(png) = cache.get(&id) {
            return Ok((
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "image/png"),
                    (header::CACHE_CONTROL, "public, max-age=86400"),
                ],
                png.clone(),
            )
                .into_response());
        }
    }

    // Render thumbnail with sample data
    let mut resume = create_sample_resume();
    resume.metadata.template = id.clone();
    let theme = get_template_theme(&id);
    resume.metadata.theme.primary = theme.primary.clone();
    resume.metadata.theme.text = theme.text.clone();
    resume.metadata.theme.background = theme.background.clone();

    let renderer = TypstRenderer::new();
    let png = renderer
        .render_preview(&resume, 0)
        .map_err(|e| ApiError::internal(format!("Failed to render thumbnail: {}", e)))?;

    // Cache the result
    {
        let mut cache = thumbnail_cache().lock().await;
        cache.insert(id, png.clone());
    }

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        png,
    )
        .into_response())
}

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
        (status = 200, description = "Successfully parsed resume", body = serde_json::Value),
        (status = 400, description = "Failed to parse resume", body = ApiError)
    )
)]
async fn parse(Json(req): Json<ParseRequest>) -> Result<Json<ResumeData>, ApiError> {
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
async fn render_pdf(Json(req): Json<RenderPdfRequest>) -> Result<Response, ApiError> {
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
async fn render_preview(Json(req): Json<RenderPreviewRequest>) -> Result<Response, ApiError> {
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
    let png = renderer
        .render_preview(&resume, req.page)
        .map_err(|e| ApiError::internal(format!("Failed to render preview: {}", e)))?;

    Ok((StatusCode::OK, [(header::CONTENT_TYPE, "image/png")], png).into_response())
}

/// Validate resume data
///
/// Checks if the provided resume data conforms to the Rustume schema.
/// Returns validation errors if the data is invalid.
#[utoipa::path(
    post,
    path = "/api/validate",
    tag = "Validate",
    request_body = ResumeData,
    responses(
        (status = 200, description = "Validation result", body = ValidationResponse)
    )
)]
async fn validate(Json(resume): Json<ResumeData>) -> Json<ValidationResponse> {
    match resume.validate() {
        Ok(_) => Json(ValidationResponse {
            valid: true,
            errors: None,
        }),
        Err(e) => Json(ValidationResponse {
            valid: false,
            errors: Some(validation_errors(&e)),
        }),
    }
}

/// Extract validation errors as strings (including nested struct and list errors)
fn validation_errors(errors: &validator::ValidationErrors) -> Vec<String> {
    fn collect_errors(
        errors: &validator::ValidationErrors,
        prefix: &str,
        result: &mut Vec<String>,
    ) {
        // Collect field errors
        for (field, errs) in errors.field_errors() {
            let field_path = if prefix.is_empty() {
                field.to_string()
            } else {
                format!("{}.{}", prefix, field)
            };
            for e in errs {
                result.push(format!(
                    "{}: {}",
                    field_path,
                    e.message
                        .as_ref()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| e.code.to_string())
                ));
            }
        }

        // Recursively collect nested struct and list errors
        for (field, nested) in errors.errors() {
            let field_path = if prefix.is_empty() {
                field.to_string()
            } else {
                format!("{}.{}", prefix, field)
            };
            match nested {
                validator::ValidationErrorsKind::Struct(nested_errors) => {
                    collect_errors(nested_errors.as_ref(), &field_path, result);
                }
                validator::ValidationErrorsKind::List(list_errors) => {
                    for (idx, nested_errors) in list_errors.iter() {
                        let indexed_path = format!("{}[{}]", field_path, idx);
                        collect_errors(nested_errors.as_ref(), &indexed_path, result);
                    }
                }
                validator::ValidationErrorsKind::Field(_) => {
                    // Already handled by field_errors() above
                }
            }
        }
    }

    let mut result = Vec::new();
    collect_errors(errors, "", &mut result);
    result
}

// ============================================================================
// Server Setup
// ============================================================================

fn create_router() -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT]);

    Router::new()
        // Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        // Health check
        .route("/health", get(health))
        // API routes
        .route("/api/templates", get(list_templates))
        .route("/api/templates/:id/thumbnail", get(template_thumbnail))
        .route("/api/parse", post(parse))
        .route("/api/render/pdf", post(render_pdf))
        .route("/api/render/preview", post(render_preview))
        .route("/api/validate", post(validate))
        // Middleware
        .layer(CompressionLayer::new())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(MAX_BODY_SIZE))
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    info!("Shutdown signal received, starting graceful shutdown");
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .init();

    let app = create_router();

    // Get port from environment or use default
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Starting Rustume API server on http://{}", addr);
    info!(
        "Swagger UI available at http://{}:{}/swagger-ui",
        addr.ip(),
        port
    );
    info!("Web UI available at http://localhost:5173 (run 'make web' or 'make dev')");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context(format!("Failed to bind to {}", addr))?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    info!("Server stopped");
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_health() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_templates() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let templates: Vec<TemplateInfo> = serde_json::from_slice(&body).unwrap();

        assert!(!templates.is_empty());
        assert!(templates.iter().any(|t| t.id == "rhyhorn"));
    }

    #[tokio::test]
    async fn test_validate_valid() {
        let app = create_router();
        let resume = ResumeData::default();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&resume).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(result.valid);
        assert!(result.errors.is_none());
    }

    #[tokio::test]
    async fn test_parse_json_resume() {
        let app = create_router();

        let json_resume = r#"{
            "basics": {
                "name": "Test User",
                "label": "Developer",
                "email": "test@example.com"
            }
        }"#;

        let request = ParseRequest {
            format: ParseFormat::JsonResume,
            data: json_resume.to_string(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let resume: ResumeData = serde_json::from_slice(&body).unwrap();

        assert_eq!(resume.basics.name, "Test User");
        assert_eq!(resume.basics.headline, "Developer");
    }

    #[tokio::test]
    async fn test_render_pdf() {
        let app = create_router();

        let request = RenderPdfRequest {
            resume: serde_json::to_value(ResumeData::default()).unwrap(),
            template: None,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/pdf")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/pdf"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        // Check PDF magic bytes
        assert!(body.starts_with(b"%PDF"));
    }

    #[tokio::test]
    async fn test_render_preview() {
        let app = create_router();

        let request = RenderPreviewRequest {
            resume: serde_json::to_value(ResumeData::default()).unwrap(),
            template: None,
            page: 0,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/preview")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get("content-type").unwrap(), "image/png");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        // Check PNG magic bytes
        assert!(body.starts_with(&[0x89, 0x50, 0x4E, 0x47]));
    }

    #[tokio::test]
    async fn test_cors_headers() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/api/templates")
                    .header("origin", "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert!(response
            .headers()
            .contains_key("access-control-allow-origin"));
    }

    #[tokio::test]
    async fn test_swagger_ui() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/swagger-ui/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_openapi_spec() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api-docs/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(spec["info"]["title"], "Rustume API");
        assert!(spec["paths"].as_object().unwrap().contains_key("/health"));
        assert!(spec["paths"]
            .as_object()
            .unwrap()
            .contains_key("/api/templates"));
    }

    #[tokio::test]
    async fn test_parse_rustume_format() {
        let app = create_router();
        let resume = ResumeData::default();

        let request = ParseRequest {
            format: ParseFormat::Rustume,
            data: serde_json::to_string(&resume).unwrap(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: ResumeData = serde_json::from_slice(&body).unwrap();

        assert_eq!(parsed.basics.name, resume.basics.name);
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let app = create_router();

        let request = ParseRequest {
            format: ParseFormat::JsonResume,
            data: "{ invalid json }".to_string(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let error: ApiError = serde_json::from_slice(&body).unwrap();

        assert!(error.error.contains("Failed to parse"));
    }

    #[tokio::test]
    async fn test_validate_invalid_email() {
        let app = create_router();
        let mut resume = ResumeData::default();
        resume.basics.email = "invalid-email".to_string();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&resume).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(
            !result.valid,
            "Expected validation to fail for invalid email"
        );
        assert!(result.errors.is_some(), "Expected errors to be present");
        let errors = result.errors.unwrap();
        // Just verify we got some validation errors - the exact format depends on validator internals
        assert!(
            !errors.is_empty(),
            "Expected at least one error, got: {:?}",
            errors
        );
    }

    #[tokio::test]
    async fn test_body_size_limit() {
        let app = create_router();

        // Create a payload larger than MAX_BODY_SIZE (10 MB)
        let large_payload = vec![b'x'; 11 * 1024 * 1024];

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(large_payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should be rejected with 413 Payload Too Large
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn test_templates_returns_expected_count() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let templates: Vec<TemplateInfo> = serde_json::from_slice(&body).unwrap();

        // Should return all 12 templates
        assert_eq!(templates.len(), 12);
        assert!(templates.iter().any(|t| t.id == "rhyhorn"));
        assert!(templates.iter().any(|t| t.id == "azurill"));
        assert!(templates.iter().any(|t| t.id == "pikachu"));
        assert!(templates.iter().any(|t| t.id == "nosepass"));
        assert!(templates.iter().any(|t| t.id == "bronzor"));
        assert!(templates.iter().any(|t| t.id == "chikorita"));
        assert!(templates.iter().any(|t| t.id == "ditto"));
        assert!(templates.iter().any(|t| t.id == "gengar"));
        assert!(templates.iter().any(|t| t.id == "glalie"));
        assert!(templates.iter().any(|t| t.id == "kakuna"));
        assert!(templates.iter().any(|t| t.id == "leafish"));
        assert!(templates.iter().any(|t| t.id == "onyx"));
    }

    #[tokio::test]
    async fn test_health_returns_json_compatible() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = std::str::from_utf8(&body).unwrap();

        assert_eq!(text, "ok");
    }
}
