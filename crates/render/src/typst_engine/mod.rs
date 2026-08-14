//! Typst-based rendering for Rustume.
//!
//! This module provides PDF generation using the Typst typesetting system.

mod engine;
mod template_layout;
mod world;

pub use engine::{get_page_size, get_template_theme, TemplateTheme, TypstRenderer, TEMPLATES};
pub use template_layout::{
    get_template_layout, BodyFont, ContactIn, HeaderStyle, HeadingCase, HeadingInk, HeadingStyle,
    KeywordStyle, LayoutMode, TemplateChrome, TemplateLayout,
};
