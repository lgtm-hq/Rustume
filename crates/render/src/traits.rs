//! Renderer trait definitions.

use rustume_schema::ResumeData;
use thiserror::Error;

/// Render error types.
#[derive(Error, Debug)]
pub enum RenderError {
    #[error("Template not found: {0}")]
    TemplateNotFound(String),

    #[error("Render failed: {0}")]
    RenderFailed(String),

    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

/// Renderer trait.
pub trait Renderer {
    /// Render resume to PDF bytes.
    fn render_pdf(&self, resume: &ResumeData) -> Result<Vec<u8>, RenderError>;

    /// Render resume to HTML string.
    fn render_html(&self, resume: &ResumeData) -> Result<String, RenderError>;

    /// Render resume preview image (PNG).
    /// `page` is zero-based (0 = first page).
    fn render_preview(&self, resume: &ResumeData, page: usize) -> Result<Vec<u8>, RenderError>;
}
