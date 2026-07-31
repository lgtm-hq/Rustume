//! Corpus test: every rich-text field of the document-editor fixture through
//! [`markdown_to_typst`], pinned against a committed golden file.
//!
//! The fixture (`tests/fixtures/v3/doc-editor.json`) is the shared corpus for
//! the document editor. This test is the tripwire for unintended conversion
//! changes: any diff in the rendered Typst shows up as a golden mismatch.
//!
//! Regenerate after a deliberate change:
//! `UPDATE_GOLDEN=1 cargo test -p rustume-utils --test markdown_corpus`

use std::fs;
use std::path::PathBuf;

use rustume_utils::markdown_to_typst;
use serde_json::Value;

/// JSON keys that hold rich text in the v3 schema.
const RICH_TEXT_KEYS: [&str; 4] = ["body", "content", "description", "summary"];

/// Path to the document-editor fixture in the workspace test corpus.
fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("utils crate must live under crates/")
        .parent()
        .expect("crates/ must live under the workspace root")
        .join("tests")
        .join("fixtures")
        .join("v3")
        .join("doc-editor.json")
}

/// Path to the committed golden file.
fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("golden")
        .join("doc-editor.typ.txt")
}

/// Collect `(json path, rich text)` for every non-empty rich-text field,
/// depth-first with object keys visited in sorted order for determinism.
fn collect_rich_text(value: &Value, path: &str, out: &mut Vec<(String, String)>) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for key in keys {
                let child = &map[key];
                let child_path = format!("{path}/{key}");
                if RICH_TEXT_KEYS.contains(&key.as_str()) {
                    if let Value::String(text) = child {
                        if !text.trim().is_empty() {
                            out.push((child_path.clone(), text.clone()));
                        }
                    }
                }
                collect_rich_text(child, &child_path, out);
            }
        }
        Value::Array(items) => {
            for (index, item) in items.iter().enumerate() {
                collect_rich_text(item, &format!("{path}[{index}]"), out);
            }
        }
        _ => {}
    }
}

/// Render the corpus into the golden file's text format.
fn render_corpus(fields: &[(String, String)]) -> String {
    let mut out = String::new();
    for (path, source) in fields {
        out.push_str("=== ");
        out.push_str(path);
        out.push_str(" ===\n");
        out.push_str(&markdown_to_typst(source));
        out.push_str("\n\n");
    }
    out
}

#[test]
fn doc_editor_fixture_matches_golden() {
    let raw = fs::read_to_string(fixture_path()).expect("failed to read doc-editor.json fixture");
    let json: Value = serde_json::from_str(&raw).expect("doc-editor.json must be valid JSON");

    let mut fields = Vec::new();
    collect_rich_text(&json, "", &mut fields);
    assert!(
        fields.len() >= 30,
        "expected the fixture to carry a substantial rich-text corpus, found {}",
        fields.len()
    );

    let actual = render_corpus(&fields);

    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        let path = golden_path();
        fs::create_dir_all(path.parent().expect("golden path must have a parent"))
            .expect("failed to create golden directory");
        fs::write(&path, &actual).expect("failed to write golden file");
        return;
    }

    let expected = fs::read_to_string(golden_path()).expect(
        "missing golden file; regenerate with \
         UPDATE_GOLDEN=1 cargo test -p rustume-utils --test markdown_corpus",
    );

    assert_eq!(
        actual, expected,
        "markdown conversion of the doc-editor corpus changed; review the diff, then \
         regenerate with UPDATE_GOLDEN=1 cargo test -p rustume-utils --test markdown_corpus"
    );
}

#[test]
fn doc_editor_fixture_never_emits_typst_code() {
    let raw = fs::read_to_string(fixture_path()).expect("failed to read doc-editor.json fixture");
    let json: Value = serde_json::from_str(&raw).expect("doc-editor.json must be valid JSON");

    let mut fields = Vec::new();
    collect_rich_text(&json, "", &mut fields);

    // Only the markup this converter emits may start a Typst code expression;
    // anything else authored by the user must arrive escaped.
    const ALLOWED_HASH_PREFIXES: [&str; 3] = ["#text(weight: \"bold\")[", "#emph[", "#linebreak()"];
    const LINK_PREFIX: &str = "#link(\"";

    for (path, source) in &fields {
        let typst = markdown_to_typst(source);
        let mut rest = typst.as_str();
        while let Some(index) = rest.find('#') {
            let escaped = index > 0 && rest.as_bytes()[index - 1] == b'\\';
            let tail = &rest[index..];
            if escaped {
                rest = &tail[1..];
                continue;
            }
            // A link's URL is a Typst string literal, so any `#` inside it is
            // inert — skip past the whole `#link("…")` head.
            if let Some(url_and_rest) = tail.strip_prefix(LINK_PREFIX) {
                let end = url_and_rest
                    .find("\")[")
                    .unwrap_or_else(|| panic!("unterminated link in {path}: {tail}"));
                rest = &url_and_rest[end + 3..];
                continue;
            }
            assert!(
                ALLOWED_HASH_PREFIXES.iter().any(|p| tail.starts_with(p)),
                "unescaped Typst code in {path}: {tail}"
            );
            rest = &tail[1..];
        }
    }
}
