//! End-to-end gate for the document editor default flip (#734).
//!
//! Boots the real axum router in-process (self-hosted stateless mode — no
//! database, no auth) and drives the full document-editor happy path: the
//! shared markdown fixture, an edit shaped exactly as the web store persists
//! it, and `POST /api/render/pdf` through to a real PDF. If this path breaks,
//! the editor must not be the default.

use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use rustume_parser::{Parser, ReactiveResumeV3Parser};
use rustume_schema::{ContentFormat, ResumeData};
use rustume_server::create_router;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tower::ServiceExt;

/// Path to the shared document-editor fixture at the workspace root.
fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("CARGO_MANIFEST_DIR should have a parent (crates/)")
        .parent()
        .expect("crates/ should have a parent (workspace root)")
        .join("tests")
        .join("fixtures")
        .join("v3")
        .join("doc-editor.json")
}

/// The fixture as the web store holds it: parsed from the v3 wire format into
/// `ResumeData`, exactly like an import does.
fn load_fixture() -> ResumeData {
    let data = fs::read(fixture_path()).expect("Failed to read doc-editor.json fixture");
    ReactiveResumeV3Parser
        .parse(&data)
        .expect("Failed to parse doc-editor.json fixture")
}

/// Apply the edit the gate is about, on the persisted JSON itself: rename the
/// basics and append an experience item with a markdown summary, shaped field
/// for field like `SectionEditor`'s `createItem` output that the web store
/// persists and sends to `/api/render/pdf`.
fn apply_web_store_edit(resume: &mut Value) {
    resume["basics"]["name"] = json!("Mireille Okafor-Reyes");

    let items = resume["sections"]["experience"]["items"]
        .as_array_mut()
        .expect("fixture should carry an experience items array");
    items.push(json!({
        "id": "exp-doc-editor-e2e",
        "visible": true,
        "company": "Lumen Health",
        "position": "Principal Engineer, Design Systems",
        "location": "Lisbon, Portugal",
        "date": "2026 — Present",
        "summary": "Leading **Halo** end to end:\n\n- Shipped the *token pipeline* powering every surface\n- Wrote the rollout notes at [okafor.design/notes](https://okafor.design/notes)",
        "url": { "label": "", "href": "" },
    }));
}

/// Pages in a PDF whose page dictionaries sit in the plain object table (as
/// typst's writer emits them): `/Type /Page` entries, with or without the
/// separating space, excluding the `/Type /Pages` tree node.
fn count_pdf_pages(pdf: &[u8]) -> usize {
    [b"/Type /Page".as_slice(), b"/Type/Page".as_slice()]
        .iter()
        .map(|needle| {
            pdf.windows(needle.len())
                .enumerate()
                .filter(|(idx, window)| {
                    window == needle && pdf.get(idx + needle.len()) != Some(&b's')
                })
                .count()
        })
        .sum()
}

#[tokio::test]
async fn doc_editor_edit_renders_a_real_pdf_end_to_end() {
    // The fixture must exercise the markdown adapter path: the flip is only
    // proven if markdown flows through the real renderer.
    let parsed = load_fixture();
    assert_eq!(
        parsed.metadata.content_format(),
        ContentFormat::Markdown,
        "fixture should declare markdown so the render takes the markdown path"
    );

    let mut resume = serde_json::to_value(&parsed).expect("ResumeData should serialize");
    apply_web_store_edit(&mut resume);

    let body = json!({ "resume": resume, "template": "onyx" });

    let app = create_router();
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/render/pdf")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string()))
                .expect("request should build"),
        )
        .await
        .expect("router should answer");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get(header::CONTENT_TYPE)
            .expect("response should carry a content type"),
        "application/pdf"
    );

    let pdf = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should collect");

    assert!(pdf.starts_with(b"%PDF-"), "response is not a PDF");
    assert!(
        count_pdf_pages(&pdf) >= 1,
        "rendered PDF should contain at least one page"
    );
}
