use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Input format for parsing
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "kebab-case")]
pub enum ParseFormat {
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
pub struct ParseRequest {
    /// Input format to parse
    #[schema(example = "json-resume")]
    pub format: ParseFormat,
    /// Resume data as string (JSON) or base64-encoded (for binary formats like LinkedIn ZIP)
    #[schema(example = r#"{"basics":{"name":"John Doe","label":"Developer"}}"#)]
    pub data: String,
    /// Set to true if data is base64 encoded (required for LinkedIn ZIP files)
    #[serde(default)]
    #[schema(example = false)]
    pub base64: bool,
}

/// Render PDF request body
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RenderPdfRequest {
    /// Resume data in Rustume format
    pub resume: serde_json::Value,
    /// Template name (optional, uses resume metadata or 'rhyhorn' default)
    #[serde(default)]
    #[schema(example = "rhyhorn")]
    pub template: Option<String>,
}

/// Render preview request body
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RenderPreviewRequest {
    /// Resume data in Rustume format
    pub resume: serde_json::Value,
    /// Template name (optional)
    #[serde(default)]
    #[schema(example = "rhyhorn")]
    pub template: Option<String>,
    /// Page number to preview (0-indexed)
    #[serde(default)]
    #[schema(example = 0)]
    pub page: usize,
}

/// Template information
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct TemplateInfo {
    /// Template identifier (slug)
    #[schema(example = "rhyhorn")]
    pub id: String,
    /// Display name
    #[schema(example = "Rhyhorn")]
    pub name: String,
    /// Theme colors for this template
    pub theme: ThemeInfo,
}

/// Theme colors for a template
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ThemeInfo {
    /// Background color (hex)
    #[schema(example = "#ffffff")]
    pub background: String,
    /// Text color (hex)
    #[schema(example = "#000000")]
    pub text: String,
    /// Primary/accent color (hex)
    #[schema(example = "#dc2626")]
    pub primary: String,
}

/// Validation response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ValidationResponse {
    /// Whether the resume is valid
    #[schema(example = true)]
    pub valid: bool,
    /// Validation error messages (only present if invalid)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(example = json!(["basics.email: invalid email format"]))]
    pub errors: Option<Vec<String>>,
}
