//! Shared utilities for Rustume.
//!
//! Provides common functionality used across crates:
//! - ID generation (CUID2)
//! - String manipulation
//! - Date handling
//! - Color conversion
//! - Layout utilities
//! - HTML sanitization
//! - Markdown and HTML to Typst conversion

mod color;
mod date;
mod html_to_typst;
mod id;
mod layout;
mod markdown_to_typst;
mod sanitize;
mod string;

pub use color::*;
pub use date::*;
pub use html_to_typst::*;
pub use id::*;
pub use layout::*;
pub use markdown_to_typst::*;
pub use sanitize::*;
pub use string::*;
