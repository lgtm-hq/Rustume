use rustume_parser::ResumeFormat;
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

impl From<ParseFormat> for ResumeFormat {
    fn from(format: ParseFormat) -> Self {
        match format {
            ParseFormat::JsonResume => Self::JsonResume,
            ParseFormat::LinkedIn => Self::LinkedIn,
            ParseFormat::Rrv3 => Self::Rrv3,
            ParseFormat::Rustume => Self::Rustume,
        }
    }
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
    /// Structural layout of this template
    pub layout: LayoutInfo,
}

/// Structural layout of a template, as rendered by its Typst source
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LayoutInfo {
    /// Column arrangement: `single`, `sidebar-left`, `sidebar-right` or `header-split`
    #[schema(example = "sidebar-left")]
    pub layout_mode: String,
    /// Page-0 section ids per column as `[main, sidebar]`, used when the resume
    /// carries no explicit layout. Single-column templates leave the second
    /// entry empty.
    #[schema(example = json!([["summary", "experience"], ["profiles", "skills"]]))]
    pub default_columns: Vec<Vec<String>>,
    /// Header presentation: `left`, `center`, `banner`, `boxed` or `sidebar`
    #[schema(example = "center")]
    pub header_style: String,
    /// Where contact details are printed: `sidebar`, `header` or `banner`
    #[schema(example = "header")]
    pub contact_in: String,
    /// Default sidebar width in typographic points, or `null` when the split is
    /// proportional or the template has no sidebar
    #[schema(example = 180)]
    pub sidebar_width: Option<u32>,
    /// Main-column section heading chrome: `band`, `underline`, `rule` or `plain`
    #[schema(example = "underline")]
    pub heading_style: String,
    /// Sidebar section heading chrome; same vocabulary as `heading_style`
    #[schema(example = "plain")]
    pub sidebar_heading_style: String,
    /// Section title case: `upper` or `as-written`
    #[schema(example = "upper")]
    pub heading_case: String,
    /// Main-column heading ink: `accent` or `text`
    #[schema(example = "accent")]
    pub heading_ink: String,
    /// Sidebar heading ink: `accent` or `text`
    #[schema(example = "accent")]
    pub sidebar_heading_ink: String,
    /// Body typeface id: `ibm-plex-sans` or `ibm-plex-serif`
    #[schema(example = "ibm-plex-sans")]
    pub font_body: String,
    /// Whether the sidebar paints a tinted background
    pub sidebar_tint: bool,
    /// Keyword presentation: `chips` or `plain`
    #[schema(example = "chips")]
    pub keyword_style: String,
    /// Whether an accent rule sits under the identity header
    pub header_rule: bool,
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
