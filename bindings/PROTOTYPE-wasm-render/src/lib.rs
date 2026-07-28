//! PROTOTYPE — THROWAWAY.
//!
//! Single question: can `rustume-render` (Typst 0.15) reach
//! `wasm32-unknown-unknown`, and what does the artifact weigh?
//!
//! Exports the two calls that would have to move into the browser for rendering
//! to be local: PDF export and preview rasterisation. Nothing else. If this
//! links, the claim in `bindings/wasm/Cargo.toml` that "Typst has native
//! dependencies that don't compile to WASM" is out of date.

use rustume_render::{Renderer, TypstRenderer};
use rustume_schema::ResumeData;
use wasm_bindgen::prelude::*;

/// Render a resume to PDF bytes, entirely in the browser.
#[wasm_bindgen]
pub fn prototype_render_pdf(resume_json: &str) -> Result<Vec<u8>, JsError> {
    let resume: ResumeData =
        serde_json::from_str(resume_json).map_err(|e| JsError::new(&e.to_string()))?;
    TypstRenderer::new()
        .render_pdf(&resume)
        .map_err(|e| JsError::new(&e.to_string()))
}

/// Rasterise one preview page to PNG bytes, entirely in the browser.
#[wasm_bindgen]
pub fn prototype_render_preview(resume_json: &str, page: usize) -> Result<Vec<u8>, JsError> {
    let resume: ResumeData =
        serde_json::from_str(resume_json).map_err(|e| JsError::new(&e.to_string()))?;
    let (png, _pages) = TypstRenderer::new()
        .render_preview(&resume, page)
        .map_err(|e| JsError::new(&e.to_string()))?;
    Ok(png)
}
