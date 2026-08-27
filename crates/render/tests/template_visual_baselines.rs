//! Per-template PDF/PNG visual baselines for the shared doc-editor fixture.
//!
//! Renders `tests/fixtures/v3/doc-editor.json` through [`TypstRenderer::render_preview_at`]
//! once per shipped template and compares page 0 against committed PNGs under
//! `baselines/pdf/`. Lives next to the Playwright sheet baselines
//! (`apps/web/e2e/__screenshots__/template-sheet.visual.spec.ts/`) for parity
//! *review* — sheet and PDF are different raster pipelines and are not
//! auto-compared (#831).
//!
//! # Regeneration
//!
//! ```sh
//! UPDATE_VISUAL_BASELINES=1 cargo test -p rustume-render --test template_visual_baselines
//! ```
//!
//! Commit the updated `crates/render/tests/baselines/pdf/*.png` files. Sheet
//! baselines regenerate via the Web E2E CI artifact (same flow as #812) — see
//! `.github/workflows/test-e2e-web.yml`.

use image::GenericImageView;
use rstest::rstest;
use rustume_parser::{Parser, ReactiveResumeV3Parser};
use rustume_render::{get_template_theme, TypstRenderer, TEMPLATES};
use rustume_schema::ResumeData;
use std::fs;
use std::path::{Path, PathBuf};

/// Moderate DPI for committed baselines (1 px/pt ≈ 595×842 for A4).
const BASELINE_PIXEL_PER_PT: f64 = 1.0;

/// Per-channel absolute delta before a pixel counts as different.
const CHANNEL_TOLERANCE: u8 = 8;

/// Maximum fraction of differing pixels allowed (matches Playwright's 2%).
const MAX_DIFF_RATIO: f64 = 0.02;

fn fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("CARGO_MANIFEST_DIR should have a parent (crates/)")
        .parent()
        .expect("crates/ should have a parent (workspace root)")
        .join("tests")
        .join("fixtures")
}

fn baselines_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("baselines")
        .join("pdf")
}

fn baseline_path(template: &str) -> PathBuf {
    baselines_dir().join(format!("{template}.png"))
}

fn update_baselines() -> bool {
    matches!(
        std::env::var("UPDATE_VISUAL_BASELINES").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

fn load_doc_editor_fixture() -> ResumeData {
    let data = fs::read(fixtures_path().join("v3").join("doc-editor.json"))
        .expect("Failed to read tests/fixtures/v3/doc-editor.json");
    ReactiveResumeV3Parser
        .parse(&data)
        .expect("Failed to parse doc-editor.json fixture")
}

/// Apply template id + matching theme colors (mirrors CLI/server thumbnail path).
fn apply_template(resume: &mut ResumeData, template: &str) {
    resume.metadata.template = template.to_string();
    let theme = get_template_theme(template);
    resume.metadata.theme.primary = theme.primary;
    resume.metadata.theme.text = theme.text;
    resume.metadata.theme.background = theme.background;
}

/// Compare two PNGs with a per-channel tolerance; returns the differing-pixel ratio.
fn png_diff_ratio(actual: &[u8], baseline: &[u8]) -> Result<f64, String> {
    let actual_img =
        image::load_from_memory(actual).map_err(|e| format!("actual PNG decode failed: {e}"))?;
    let baseline_img = image::load_from_memory(baseline)
        .map_err(|e| format!("baseline PNG decode failed: {e}"))?;

    if actual_img.dimensions() != baseline_img.dimensions() {
        return Err(format!(
            "dimension mismatch: actual {:?} vs baseline {:?}",
            actual_img.dimensions(),
            baseline_img.dimensions()
        ));
    }

    let actual_rgba = actual_img.to_rgba8();
    let baseline_rgba = baseline_img.to_rgba8();
    let total = actual_rgba.len() / 4;
    if total == 0 {
        return Ok(0.0);
    }

    let mut differing = 0usize;
    for (a, b) in actual_rgba
        .chunks_exact(4)
        .zip(baseline_rgba.chunks_exact(4))
    {
        if (0..4).any(|i| a[i].abs_diff(b[i]) > CHANNEL_TOLERANCE) {
            differing += 1;
        }
    }

    Ok(differing as f64 / total as f64)
}

fn assert_matches_baseline(template: &str, png: &[u8]) {
    let path = baseline_path(template);
    if update_baselines() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap_or_else(|e| {
                panic!("Failed to create {}: {e}", parent.display());
            });
        }
        fs::write(&path, png).unwrap_or_else(|e| {
            panic!("Failed to write baseline {}: {e}", path.display());
        });
        eprintln!("updated baseline {}", path.display());
        return;
    }

    assert!(
        path.is_file(),
        "Missing PDF visual baseline for '{template}' at {}.\n\
         Regenerate with:\n\
         UPDATE_VISUAL_BASELINES=1 cargo test -p rustume-render --test template_visual_baselines",
        path.display()
    );

    let baseline = fs::read(&path).unwrap_or_else(|e| {
        panic!("Failed to read baseline {}: {e}", path.display());
    });

    let ratio = png_diff_ratio(png, &baseline).unwrap_or_else(|e| {
        panic!("PNG compare failed for '{template}': {e}");
    });
    assert!(
        ratio <= MAX_DIFF_RATIO,
        "PDF visual baseline drift for '{template}': {:.2}% of pixels differ \
         (limit {:.2}%, channel tolerance ±{CHANNEL_TOLERANCE}).\n\
         Baseline: {}\n\
         Regenerate with UPDATE_VISUAL_BASELINES=1 if the change is intentional.",
        ratio * 100.0,
        MAX_DIFF_RATIO * 100.0,
        path.display()
    );
}

#[test]
fn baseline_dir_covers_every_template() {
    // Guard against adding a template without a baseline slot — the rstest
    // cases below are hand-listed, so this catches TEMPLATES drift.
    if update_baselines() {
        return;
    }
    assert!(
        baselines_dir().is_dir(),
        "PDF baseline directory missing at {} — a deleted tree must not \
         soft-pass the TEMPLATES coverage guard. Regenerate with \
         UPDATE_VISUAL_BASELINES=1.",
        baselines_dir().display()
    );
    for template in TEMPLATES {
        let path = baseline_path(template);
        assert!(
            path.is_file(),
            "Template '{template}' is in TEMPLATES but has no baseline at {}.\n\
             Add a #[case(\"{template}\")] arm and regenerate baselines.",
            path.display()
        );
    }
}

#[rstest]
#[case("rhyhorn")]
#[case("azurill")]
#[case("pikachu")]
#[case("nosepass")]
#[case("bronzor")]
#[case("chikorita")]
#[case("ditto")]
#[case("gengar")]
#[case("glalie")]
#[case("kakuna")]
#[case("leafish")]
#[case("onyx")]
fn template_pdf_visual_baseline(#[case] template: &str) {
    let mut resume = load_doc_editor_fixture();
    apply_template(&mut resume, template);

    let renderer = TypstRenderer::new();
    let (png, pages) = renderer
        .render_preview_at(&resume, 0, BASELINE_PIXEL_PER_PT)
        .unwrap_or_else(|e| panic!("render_preview_at failed for '{template}': {e:?}"));

    assert!(pages >= 1, "'{template}' should render at least one page");
    assert!(
        png.starts_with(&[0x89, 0x50, 0x4E, 0x47]),
        "'{template}' output is not a PNG"
    );

    assert_matches_baseline(template, &png);
}

/// Template whose sidebar custom section carries a labeled URL in the fixture.
const CUSTOM_URL_TEMPLATE: &str = "pikachu";

/// PDF page that carries pikachu's "Talks & Workshops" sidebar section.
///
/// The fixture places `speaking` last in layout page 0's sidebar column, so it
/// belongs to the FIRST layout page; on pikachu that column overflows and the
/// section lands on PDF page 1.
const CUSTOM_URL_PAGE: usize = 1;

/// Baseline slot for the labeled custom-section URL (#919). The per-template
/// baselines above all freeze PDF page 0, which on pikachu stops before the
/// overflowing sidebar reaches `speaking`, so the label-over-href fix needs its
/// own slot on the page the section actually renders on.
const CUSTOM_URL_BASELINE: &str = "pikachu-custom-url";

/// The fixture's `Talks & Workshops` sidebar item carries
/// `url: { label: "Slides & transcript", href: … }`. Its visible link text must
/// be the label, not the raw href (#919) — this baseline freezes that page.
#[test]
fn custom_section_url_label_visual_baseline() {
    let mut resume = load_doc_editor_fixture();
    apply_template(&mut resume, CUSTOM_URL_TEMPLATE);

    let renderer = TypstRenderer::new();
    let (png, pages) = renderer
        .render_preview_at(&resume, CUSTOM_URL_PAGE, BASELINE_PIXEL_PER_PT)
        .unwrap_or_else(|e| panic!("render_preview_at failed for '{CUSTOM_URL_BASELINE}': {e:?}"));

    assert!(
        pages > CUSTOM_URL_PAGE,
        "fixture should render past page {CUSTOM_URL_PAGE} on '{CUSTOM_URL_TEMPLATE}'"
    );
    assert!(
        png.starts_with(&[0x89, 0x50, 0x4E, 0x47]),
        "'{CUSTOM_URL_BASELINE}' output is not a PNG"
    );

    assert_matches_baseline(CUSTOM_URL_BASELINE, &png);
}

#[test]
fn baselines_readme_documents_parity_review() {
    let readme = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("baselines")
        .join("README.md");
    let contents = fs::read_to_string(&readme).unwrap_or_else(|e| {
        panic!("Missing {}: {e}", readme.display());
    });
    assert!(
        contents.contains("parity review"),
        "baselines README must explain sheet↔PDF parity is reviewed, not auto-diffed"
    );
}
