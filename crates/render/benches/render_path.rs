//! Criterion benches for the render request path hot spots (#799).
//!
//! - `prepare_source`: Typst source generation for the doc-editor corpus
//!   (includes rich-text preprocess + JSON escape of the full resume).
//! - `render_pdf`: end-to-end compile of that fixture.
//! - `markdown_to_typst`: micro-bench over the fixture's rich-text fields.
//!
//! Run: `cargo bench -p rustume-render --bench render_path`

use std::fs;
use std::hint::black_box;
use std::path::PathBuf;

use criterion::{criterion_group, criterion_main, Criterion};
use rustume_render::{Renderer, TypstRenderer};
use rustume_schema::ResumeData;
use rustume_utils::markdown_to_typst;
use serde_json::Value;

const RICH_TEXT_KEYS: [&str; 4] = ["body", "content", "description", "summary"];

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("render crate under crates/")
        .parent()
        .expect("crates/ under workspace root")
        .join("tests")
        .join("fixtures")
        .join("v3")
        .join("doc-editor.json")
}

fn load_doc_editor_resume() -> ResumeData {
    let raw = fs::read(fixture_path()).expect("read doc-editor.json");
    serde_json::from_slice(&raw).expect("parse doc-editor.json as ResumeData")
}

fn collect_rich_text(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, child) in map {
                if RICH_TEXT_KEYS.contains(&key.as_str()) {
                    if let Value::String(text) = child {
                        if !text.trim().is_empty() {
                            out.push(text.clone());
                        }
                    }
                }
                collect_rich_text(child, out);
            }
        }
        Value::Array(items) => {
            for child in items {
                collect_rich_text(child, out);
            }
        }
        _ => {}
    }
}

fn load_markdown_fields() -> Vec<String> {
    let raw = fs::read_to_string(fixture_path()).expect("read doc-editor.json");
    let json: Value = serde_json::from_str(&raw).expect("parse JSON");
    let mut fields = Vec::new();
    collect_rich_text(&json, &mut fields);
    assert!(
        !fields.is_empty(),
        "doc-editor fixture must contain rich-text fields"
    );
    fields
}

fn bench_prepare_source(c: &mut Criterion) {
    let resume = load_doc_editor_resume();
    let renderer = TypstRenderer::new();

    c.bench_function("prepare_source_doc_editor", |b| {
        b.iter(|| {
            let source = renderer
                .generate_source(black_box(&resume))
                .expect("prepare_source via generate_source");
            black_box(source);
        });
    });
}

fn bench_render_pdf(c: &mut Criterion) {
    let resume = load_doc_editor_resume();
    let renderer = TypstRenderer::new();

    c.bench_function("render_pdf_doc_editor", |b| {
        b.iter(|| {
            let pdf = renderer.render_pdf(black_box(&resume)).expect("render_pdf");
            black_box(pdf);
        });
    });
}

fn bench_markdown_to_typst(c: &mut Criterion) {
    let fields = load_markdown_fields();

    c.bench_function("markdown_to_typst_doc_editor_fields", |b| {
        b.iter(|| {
            let mut total_len = 0usize;
            for field in &fields {
                total_len += markdown_to_typst(black_box(field)).len();
            }
            black_box(total_len);
        });
    });
}

criterion_group!(
    benches,
    bench_prepare_source,
    bench_render_pdf,
    bench_markdown_to_typst
);
criterion_main!(benches);
