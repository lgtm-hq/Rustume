//! Typst-based rendering for Rustume.
//!
//! This module provides PDF generation using the Typst typesetting system.

mod engine;
mod world;

pub use engine::{get_page_size, get_template_theme, TemplateTheme, TypstRenderer, TEMPLATES};
