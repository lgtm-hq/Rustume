//! Template engine and PDF generation for Rustume.
//!
//! Uses Typst for high-quality PDF rendering without browser dependencies.
//!
//! ## Template overrides
//!
//! Native builds embed Typst templates at compile time. Set `RUSTUME_TEMPLATES_DIR` to a
//! directory of `<name>.typ` files to override embedded templates at render time without
//! rebuilding. WASM builds use embedded templates only.
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
//! let (png_bytes, _total_pages) = renderer.render_preview(&resume, 0)?;
//! ```

mod traits;
mod typst_engine;

pub use traits::{RenderError, Renderer};
pub use typst_engine::{
    get_page_size, get_template_theme, TemplateTheme, TypstRenderer, TEMPLATES,
};
