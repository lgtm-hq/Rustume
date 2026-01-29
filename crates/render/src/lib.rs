//! Template engine and PDF generation for Rustume.
//!
//! Uses Typst for high-quality PDF rendering without browser dependencies.
//!
//! # Example
//!
//! ```ignore
//! use rustume_render::{TypstRenderer, Renderer};
//! use rustume_schema::ResumeData;
//!
//! let resume = ResumeData::default();
//! let renderer = TypstRenderer::new();
//!
//! // Generate PDF
//! let pdf_bytes = renderer.render_pdf(&resume)?;
//!
//! // Generate preview image
//! let png_bytes = renderer.render_preview(&resume, 0)?;
//! ```

mod traits;
mod typst_engine;

pub use traits::{RenderError, Renderer};
pub use typst_engine::{
    get_page_size, get_template_theme, TemplateTheme, TypstRenderer, TEMPLATES,
};
