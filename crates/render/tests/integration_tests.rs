//! Integration tests for the render crate.
//!
//! These tests verify that the Typst renderer can compile and render
//! resumes to PDF and PNG output.

use rstest::rstest;
use rustume_parser::{JsonResumeParser, Parser, ReactiveResumeV3Parser};
use rustume_render::{get_page_size, get_template_theme, Renderer, TypstRenderer, TEMPLATES};
use rustume_schema::{
    Award, Basics, ContentFormat, CustomField, CustomItem, Education, Experience, LevelDisplay,
    PageFormat, Picture, PictureEffects, Profile, Project, ResumeData, Section, Skill, Url,
};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Get the path to test fixtures directory.
/// Path: crates/render/ -> crates/ -> workspace root -> tests/fixtures
fn fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("CARGO_MANIFEST_DIR should have a parent (crates/)")
        .parent()
        .expect("crates/ should have a parent (workspace root)")
        .join("tests")
        .join("fixtures")
}

// ============================================================================
// Template Tests
// ============================================================================

#[test]
fn test_templates_list() {
    assert!(!TEMPLATES.is_empty());
    assert!(TEMPLATES.contains(&"rhyhorn"));
}

/// Verify that the hardcoded template list in the WASM binding stays in sync
/// with the canonical TEMPLATES constant. The WASM crate cannot depend on
/// rustume_render (native Typst deps), so the list is duplicated there.
/// Checks both directions: every TEMPLATES entry exists in WASM, and every
/// WASM entry exists in TEMPLATES.
#[test]
fn test_wasm_template_list_in_sync() {
    let wasm_src = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("bindings/wasm/src/lib.rs");

    let contents = fs::read_to_string(&wasm_src)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", wasm_src.display()));

    // Forward check: every canonical template appears in the WASM source
    for template in TEMPLATES {
        assert!(
            contents.contains(&format!("\"{template}\"")),
            "Template '{template}' is in TEMPLATES but missing from bindings/wasm/src/lib.rs. \
             Keep the hardcoded list in list_templates() in sync with engine.rs::TEMPLATES."
        );
    }

    // Reverse check: extract template names from the WASM list_templates() vec
    // and verify each one exists in the canonical TEMPLATES constant.
    // The vec entries look like:  "template_name",
    let wasm_templates: Vec<&str> = contents
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            // Match lines like `"rhyhorn",` inside the list_templates vec
            if trimmed.starts_with('"') && trimmed.ends_with("\",") {
                Some(&trimmed[1..trimmed.len() - 2])
            } else {
                None
            }
        })
        .collect();

    assert!(
        !wasm_templates.is_empty(),
        "Failed to parse any template names from bindings/wasm/src/lib.rs"
    );

    for wasm_template in &wasm_templates {
        assert!(
            TEMPLATES.contains(wasm_template),
            "Template '{wasm_template}' is in bindings/wasm/src/lib.rs but missing from \
             TEMPLATES. Keep the lists in sync."
        );
    }

    assert_eq!(
        TEMPLATES.len(),
        wasm_templates.len(),
        "Template count mismatch: TEMPLATES has {} but WASM has {}",
        TEMPLATES.len(),
        wasm_templates.len()
    );
}

#[rstest]
#[case("rhyhorn", "#65a30d", "#ffffff", "#000000")]
#[case("azurill", "#d97706", "#ffffff", "#1f2937")]
#[case("pikachu", "#ca8a04", "#ffffff", "#1c1917")]
#[case("nosepass", "#3b82f6", "#ffffff", "#1f2937")]
#[case("bronzor", "#0891b2", "#ffffff", "#1f2937")]
#[case("chikorita", "#16a34a", "#ffffff", "#166534")]
#[case("ditto", "#0891b2", "#ffffff", "#1f2937")]
#[case("gengar", "#67b8c8", "#ffffff", "#1f2937")]
#[case("glalie", "#14b8a6", "#ffffff", "#0f172a")]
#[case("kakuna", "#78716c", "#ffffff", "#422006")]
#[case("leafish", "#9f1239", "#ffffff", "#1f2937")]
#[case("onyx", "#dc2626", "#ffffff", "#111827")]
fn test_template_theme(
    #[case] template: &str,
    #[case] primary: &str,
    #[case] background: &str,
    #[case] text: &str,
) {
    let theme = get_template_theme(template);
    assert_eq!(
        theme.primary, primary,
        "primary color mismatch for '{template}'"
    );
    assert_eq!(
        theme.background, background,
        "background color mismatch for '{template}'"
    );
    assert_eq!(theme.text, text, "text color mismatch for '{template}'");
}

#[test]
fn test_unknown_template_theme_falls_back() {
    let unknown = get_template_theme("unknown");
    assert_eq!(unknown.primary, "#65a30d");
    assert_eq!(unknown.background, "#ffffff");
    assert_eq!(unknown.text, "#000000");
}

#[test]
fn test_page_sizes() {
    let a4 = get_page_size(PageFormat::A4);
    assert!((a4.0 - 595.28).abs() < 0.01);
    assert!((a4.1 - 841.89).abs() < 0.01);

    let letter = get_page_size(PageFormat::Letter);
    assert!((letter.0 - 612.0).abs() < 0.01);
    assert!((letter.1 - 792.0).abs() < 0.01);
}

// ============================================================================
// Source Generation Tests
// ============================================================================

#[test]
fn test_generate_source_minimal() {
    let resume = ResumeData::default();
    let renderer = TypstRenderer::new();

    let source = renderer.generate_source(&resume);
    assert!(source.is_ok());

    let source = source.unwrap();
    assert!(source.contains("#import \"templates/rhyhorn.typ\": template"));
    assert!(source.contains("#template(data)"));
}

#[test]
#[allow(clippy::field_reassign_with_default)]
fn test_generate_source_with_data() {
    let mut resume = ResumeData::default();
    resume.basics = Basics::new("Test User")
        .with_headline("Software Engineer")
        .with_email("test@example.com");

    let renderer = TypstRenderer::new();
    let source = renderer.generate_source(&resume).unwrap();

    assert!(source.contains("Test User"));
    assert!(source.contains("Software Engineer"));
}

#[test]
fn test_generate_source_page_settings() {
    let mut resume = ResumeData::default();
    resume.metadata.page.format = PageFormat::Letter;
    resume.metadata.page.margin = 24;

    let renderer = TypstRenderer::new();
    let source = renderer.generate_source(&resume).unwrap();

    assert!(source.contains("us-letter"));
    assert!(source.contains("margin: 24pt"));
}

#[test]
#[allow(clippy::field_reassign_with_default)]
fn test_generate_source_embeds_metadata_font_size() {
    let mut resume = ResumeData::default();
    resume.metadata.typography.font.size = 18;
    let source = TypstRenderer::new().generate_source(&resume).unwrap();
    assert!(source.contains("size: 18pt"));
}

#[test]
fn test_render_honours_metadata_font_size() {
    let mut small = sample_resume();
    small.metadata.typography.font.size = 10;
    let mut large = sample_resume();
    large.metadata.typography.font.size = 18;

    let renderer = TypstRenderer::new();
    let small_pdf = renderer
        .render_pdf(&small)
        .expect("10pt resume should render");
    let large_pdf = renderer
        .render_pdf(&large)
        .expect("18pt resume should render");
    assert_ne!(
        small_pdf, large_pdf,
        "metadata.typography.font.size must change the rendered PDF"
    );
}

#[test]
fn test_render_clamps_sub_one_line_height() {
    let mut resume = sample_resume();
    resume.metadata.typography.line_height = 0.5;

    TypstRenderer::new()
        .render_pdf(&resume)
        .expect("lineHeight < 1.0 must clamp at the Typst boundary and still render");
}

// ============================================================================
// PDF Rendering Tests
// ============================================================================

#[allow(clippy::field_reassign_with_default)]
fn sample_resume() -> ResumeData {
    let mut resume = ResumeData::default();

    resume.basics = Basics::new("John Doe")
        .with_headline("Senior Software Engineer")
        .with_email("john@example.com")
        .with_phone("+1-555-123-4567")
        .with_location("San Francisco, CA");

    resume.sections.summary.content =
        "Experienced software engineer with 10+ years in building scalable systems.".to_string();

    resume.sections.experience = Section::new("experience", "Experience");
    resume.sections.experience.add_item(
        Experience::new("Acme Corp", "Senior Developer")
            .with_location("San Francisco, CA")
            .with_date("2020 - Present")
            .with_summary("Led development of core platform features."),
    );
    resume.sections.experience.add_item(
        Experience::new("StartupXYZ", "Developer")
            .with_location("New York, NY")
            .with_date("2015 - 2020")
            .with_summary("Built MVP from scratch."),
    );

    resume.sections.education = Section::new("education", "Education");
    resume.sections.education.add_item(
        Education::new("MIT", "Computer Science")
            .with_study_type("Bachelor of Science")
            .with_date("2011 - 2015")
            .with_score("3.9 GPA"),
    );

    resume.sections.skills = Section::new("skills", "Skills");
    resume
        .sections
        .skills
        .add_item(Skill::new("Rust").with_level(5).with_keywords(vec![
            "Systems Programming".to_string(),
            "WebAssembly".to_string(),
        ]));
    resume.sections.skills.add_item(
        Skill::new("TypeScript")
            .with_level(4)
            .with_keywords(vec!["React".to_string(), "Node.js".to_string()]),
    );

    resume
}

#[test]
fn test_render_pdf_minimal() {
    let resume = ResumeData::default();
    let renderer = TypstRenderer::new();

    let result = renderer.render_pdf(&resume);
    assert!(result.is_ok(), "PDF rendering failed: {:?}", result.err());

    let pdf = result.unwrap();
    // PDF files start with %PDF-
    assert!(pdf.starts_with(b"%PDF-"), "Output is not a valid PDF");
    assert!(pdf.len() > 100, "PDF seems too small");
}

#[test]
fn test_render_pdf_with_content() {
    let resume = sample_resume();
    let renderer = TypstRenderer::new();

    let result = renderer.render_pdf(&resume);
    assert!(result.is_ok(), "PDF rendering failed: {:?}", result.err());

    let pdf = result.unwrap();
    assert!(pdf.starts_with(b"%PDF-"));

    // Verify PDF is complete by checking for EOF marker
    let pdf_str = String::from_utf8_lossy(&pdf);
    assert!(
        pdf_str.contains("%%EOF"),
        "PDF should end with %%EOF marker"
    );
}

#[test]
fn test_render_pdf_from_json_resume() {
    let fixture_path = fixtures_path().join("json_resume").join("full.json");
    let data = fs::read(&fixture_path).expect("Failed to read fixture");

    let parser = JsonResumeParser;
    let resume = parser.parse(&data).expect("Failed to parse fixture");

    let renderer = TypstRenderer::new();
    let result = renderer.render_pdf(&resume);

    assert!(result.is_ok(), "PDF rendering failed: {:?}", result.err());

    let pdf = result.unwrap();
    assert!(pdf.starts_with(b"%PDF-"));
}

#[test]
fn test_render_pdf_from_v3_resume() {
    let fixture_path = fixtures_path().join("v3").join("complete.json");
    let data = fs::read(&fixture_path).expect("Failed to read fixture");

    let parser = ReactiveResumeV3Parser;
    let resume = parser.parse(&data).expect("Failed to parse fixture");

    let renderer = TypstRenderer::new();
    let result = renderer.render_pdf(&resume);

    assert!(result.is_ok(), "PDF rendering failed: {:?}", result.err());

    let pdf = result.unwrap();
    assert!(pdf.starts_with(b"%PDF-"));
}

/// The document-editor fixture declares a sidebar template, a two-page layout,
/// and markdown-bearing rich text. Renders must stay clean as those downstream
/// features land.
#[test]
fn test_render_pdf_from_v3_doc_editor_resume() {
    let fixture_path = fixtures_path().join("v3").join("doc-editor.json");
    let data = fs::read(&fixture_path).expect("Failed to read fixture");

    let parser = ReactiveResumeV3Parser;
    let resume = parser.parse(&data).expect("Failed to parse fixture");
    assert_eq!(
        resume.metadata.template, "ditto",
        "fixture should exercise a sidebar template"
    );
    assert_eq!(
        resume.metadata.content_format(),
        ContentFormat::Markdown,
        "fixture should declare markdown so the render takes the markdown path"
    );

    let renderer = TypstRenderer::new();
    let result = renderer.render_pdf(&resume);

    assert!(result.is_ok(), "PDF rendering failed: {:?}", result.err());

    let pdf = result.unwrap();
    assert!(pdf.starts_with(b"%PDF-"));
}

// ============================================================================
// Preview Rendering Tests
// ============================================================================

#[test]
fn test_render_preview_page_0() {
    let resume = sample_resume();
    let renderer = TypstRenderer::new();

    let result = renderer.render_preview(&resume, 0);
    assert!(
        result.is_ok(),
        "Preview rendering failed: {:?}",
        result.err()
    );

    let (png, total_pages) = result.unwrap();
    // PNG files start with the PNG signature
    assert!(
        png.starts_with(&[0x89, 0x50, 0x4E, 0x47]),
        "Output is not a valid PNG"
    );
    assert!(total_pages >= 1, "Should have at least one page");
}

#[test]
fn test_render_preview_invalid_page() {
    let resume = ResumeData::default();
    let renderer = TypstRenderer::new();

    // Page 99 doesn't exist
    let result = renderer.render_preview(&resume, 99);
    assert!(result.is_err(), "Should fail for invalid page");
}

// ============================================================================
// Edge Cases
// ============================================================================

#[test]
#[allow(clippy::field_reassign_with_default)]
fn test_render_special_characters() {
    let mut resume = ResumeData::default();
    resume.basics = Basics::new("José García-López")
        .with_headline("Développeur & Ingénieur")
        .with_email("jose@example.com");

    resume.sections.summary.content =
        "Experience with: C++, C#, SQL & NoSQL. Speaks: 日本語, 中文".to_string();

    let renderer = TypstRenderer::new();
    let result = renderer.render_pdf(&resume);

    assert!(
        result.is_ok(),
        "PDF rendering failed with special chars: {:?}",
        result.err()
    );
}

#[test]
#[allow(clippy::field_reassign_with_default)]
fn test_render_long_content() {
    let mut resume = ResumeData::default();
    resume.basics = Basics::new("Long Content Test").with_headline("Test");

    // Add many experience items
    resume.sections.experience = Section::new("experience", "Experience");
    for i in 0..20 {
        resume.sections.experience.add_item(
            Experience::new(format!("Company {}", i), format!("Position {}", i))
                .with_summary("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."),
        );
    }

    let renderer = TypstRenderer::new();
    let result = renderer.render_pdf(&resume);

    assert!(
        result.is_ok(),
        "PDF rendering failed with long content: {:?}",
        result.err()
    );
}

#[test]
fn test_render_html_not_supported() {
    let resume = ResumeData::default();
    let renderer = TypstRenderer::new();

    let result = renderer.render_html(&resume);
    assert!(result.is_err(), "HTML rendering should not be supported");
}

// ============================================================================
// Template Selection Tests
// ============================================================================

#[test]
fn test_renderer_with_custom_template() {
    let renderer = TypstRenderer::with_template("rhyhorn");
    let resume = ResumeData::default();

    let source = renderer.generate_source(&resume).unwrap();
    assert!(source.contains("rhyhorn"));
}

#[test]
fn test_renderer_falls_back_to_default() {
    let mut resume = ResumeData::default();
    resume.metadata.template = "nonexistent_template".to_string();

    let renderer = TypstRenderer::new();
    let source = renderer.generate_source(&resume).unwrap();

    // Should fall back to default (rhyhorn)
    assert!(source.contains("rhyhorn"));
}

// ============================================================================
// Per-Template PDF Rendering Tests
// ============================================================================

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
fn test_render_template_with_content(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();

    let result = renderer.render_pdf(&resume);
    assert!(
        result.is_ok(),
        "PDF rendering failed for template '{}': {:?}",
        template_name,
        result.err()
    );

    let pdf = result.unwrap();
    assert!(
        pdf.starts_with(b"%PDF-"),
        "Output for '{}' is not a valid PDF",
        template_name
    );
}

#[rstest]
#[case("azurill")]
#[case("pikachu")]
#[case("chikorita")]
#[case("ditto")]
#[case("gengar")]
#[case("glalie")]
fn test_sidebar_templates_render_with_and_without_sidebar_ratio(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    for sidebar_ratio in [None, Some(0.1), Some(0.25), Some(0.5)] {
        let mut resume = sample_resume();
        resume.metadata.template = template_name.to_string();
        resume.metadata.page.sidebar_ratio = sidebar_ratio;

        let result = renderer.render_pdf(&resume);
        assert!(
            result.is_ok(),
            "PDF rendering failed for template '{template_name}' with sidebar ratio {sidebar_ratio:?}: {:?}",
            result.err()
        );
        assert!(result.unwrap().starts_with(b"%PDF-"));
    }
}

/// The ratio must actually change the layout (not merely render), and raw
/// out-of-range values must hit the render-time clamp — the export path
/// renders stored JSON without schema validation.
#[rstest]
#[case("azurill")]
#[case("pikachu")]
fn test_sidebar_ratio_changes_layout_and_clamps(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let render = |ratio: Option<f32>| {
        let mut resume = sample_resume();
        resume.metadata.template = template_name.to_string();
        resume.metadata.page.sidebar_ratio = ratio;
        renderer.render_pdf(&resume).unwrap()
    };

    // These comparisons require byte-deterministic output. Fail loudly if
    // that ever changes so the assertions get reworked instead of silently
    // stopping to enforce anything.
    let narrow = render(Some(0.1));
    assert_eq!(
        render(Some(0.1)),
        narrow,
        "PDF output is no longer byte-deterministic; rework this test's \
         comparisons (e.g. compare rendered PNG pixels or generated Typst \
         source) instead of skipping"
    );

    let wide = render(Some(0.5));
    assert_ne!(
        narrow, wide,
        "sidebar ratio has no effect on layout for '{template_name}'"
    );

    // Values outside [0.1, 0.5] clamp to the nearest bound.
    assert_eq!(
        render(Some(-1.0)),
        narrow,
        "ratio below range should clamp to 0.1 for '{template_name}'"
    );
    assert_eq!(
        render(Some(0.75)),
        wide,
        "ratio above range should clamp to 0.5 for '{template_name}'"
    );
}

/// Build a resume with `count` experience items carrying predictable ids
/// (`exp_0`, `exp_1`, …) so tests can reference them as break markers.
fn resume_with_experience_items(template_name: &str, count: usize) -> ResumeData {
    let mut resume = ResumeData::default();
    resume.metadata.template = template_name.to_string();
    resume.sections.experience = Section::new("experience", "Experience");
    for i in 0..count {
        let mut exp = Experience::new(format!("Company {i}"), "Engineer")
            .with_date("2020 - Present")
            .with_summary("Shipped features.");
        exp.id = format!("exp_{i}");
        resume.sections.experience.add_item(exp);
    }
    resume
}

/// Mid-section item breaks must split a single-column render across pages:
/// two break markers on a three-item section yield two extra pages, each
/// continuation slice starting on a fresh page.
#[rstest]
#[case("rhyhorn")]
#[case("onyx")]
#[case("nosepass")]
fn test_item_breaks_split_single_column_templates_across_pages(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    let base = resume_with_experience_items(template_name, 3);
    let (_, pages_without) = renderer
        .render_preview(&base, 0)
        .expect("render without breaks");

    let mut broken = base;
    broken.metadata.item_breaks.insert(
        "experience".to_string(),
        vec!["exp_1".to_string(), "exp_2".to_string()],
    );
    let (_, pages_with) = renderer
        .render_preview(&broken, 0)
        .expect("render with breaks");

    assert_eq!(
        pages_with,
        pages_without + 2,
        "two item breaks should add two pages for '{template_name}' \
         (without: {pages_without}, with: {pages_with})"
    );
}

/// A break marker on a section's first item is a no-op — the editor's
/// pipeline strips the empty leading slice, and the renderer must agree
/// instead of emitting a blank page.
#[test]
fn test_item_break_on_first_item_is_a_no_op() {
    let renderer = TypstRenderer::new();

    let base = resume_with_experience_items("rhyhorn", 2);
    let (_, pages_without) = renderer.render_preview(&base, 0).unwrap();

    let mut broken = base;
    broken
        .metadata
        .item_breaks
        .insert("experience".to_string(), vec!["exp_0".to_string()]);
    let (_, pages_with) = renderer.render_preview(&broken, 0).unwrap();

    assert_eq!(pages_with, pages_without);
}

/// Break markers on non-main-flow sections (spec §3.4 guard) are ignored.
#[test]
fn test_item_breaks_ignored_on_non_main_sections() {
    let renderer = TypstRenderer::new();

    let mut base = resume_with_experience_items("rhyhorn", 2);
    base.sections.skills = Section::new("skills", "Skills");
    let mut skill = Skill::new("Rust").with_level(5);
    skill.id = "skill_0".to_string();
    base.sections.skills.add_item(skill);
    let mut skill = Skill::new("Typst").with_level(4);
    skill.id = "skill_1".to_string();
    base.sections.skills.add_item(skill);

    let (_, pages_without) = renderer.render_preview(&base, 0).unwrap();

    let mut broken = base.clone();
    broken
        .metadata
        .item_breaks
        .insert("skills".to_string(), vec!["skill_1".to_string()]);
    let (_, pages_with) = renderer.render_preview(&broken, 0).unwrap();

    assert_eq!(
        pages_with, pages_without,
        "skills is not a main-flow section; its break markers must be ignored"
    );
}

/// Every template must keep rendering when item breaks are present. Typst
/// forbids pagebreaks inside grid containers, so grid-based layouts
/// (sidebar/two-column) ignore the markers rather than failing to compile.
#[rstest]
fn test_all_templates_render_with_item_breaks(
    #[values(
        "rhyhorn",
        "azurill",
        "pikachu",
        "nosepass",
        "bronzor",
        "chikorita",
        "ditto",
        "gengar",
        "glalie",
        "kakuna",
        "leafish",
        "onyx"
    )]
    template_name: &str,
) {
    let renderer = TypstRenderer::new();
    let mut resume = resume_with_experience_items(template_name, 3);
    resume.metadata.item_breaks.insert(
        "experience".to_string(),
        vec!["exp_1".to_string(), "exp_2".to_string()],
    );

    let result = renderer.render_pdf(&resume);
    assert!(
        result.is_ok(),
        "PDF rendering failed for template '{template_name}' with item breaks: {:?}",
        result.as_ref().err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
}

/// Each new per-item field must reach the rendered output on its own. They are
/// asserted one at a time, from the same baseline: bundled together, a single
/// working path would mask three broken ones.
#[rstest]
fn test_each_new_item_field_changes_rendered_output(
    #[values("rhyhorn", "azurill")] template_name: &str,
    #[values(
        "experience-keywords",
        "experience-custom-fields",
        "education-keywords",
        "education-custom-fields"
    )]
    field: &str,
) {
    let renderer = TypstRenderer::new();
    let mut base = resume_with_experience_items(template_name, 1);
    base.sections.education = Section::new("education", "Education");
    let mut edu = Education::new("MIT", "Computer Science")
        .with_study_type("BSc")
        .with_date("2014 - 2018");
    edu.id = "edu_0".to_string();
    base.sections.education.add_item(edu);

    // These comparisons require byte-deterministic output. Fail loudly if
    // that ever changes so the assertions get reworked instead of silently
    // stopping to enforce anything.
    let plain = renderer.render_pdf(&base).unwrap();
    assert_eq!(
        renderer.render_pdf(&base).unwrap(),
        plain,
        "PDF output is no longer byte-deterministic; rework this test's \
         comparisons instead of skipping"
    );

    let mut enriched = base;
    match field {
        "experience-keywords" => {
            enriched.sections.experience.items[0].keywords =
                vec!["Rust".to_string(), "Typst".to_string()];
        }
        "experience-custom-fields" => {
            enriched.sections.experience.items[0].custom_fields =
                vec![CustomField::new("Stack", "Axum + SolidJS")];
        }
        "education-keywords" => {
            enriched.sections.education.items[0].keywords = vec!["Thesis".to_string()];
        }
        "education-custom-fields" => {
            enriched.sections.education.items[0].custom_fields =
                vec![CustomField::new("GPA scale", "4.0")];
        }
        other => panic!("unhandled field case: {other}"),
    }

    let with_field = renderer.render_pdf(&enriched).unwrap();
    assert_ne!(
        plain, with_field,
        "'{field}' has no effect on rendered output for '{template_name}'"
    );
}

/// Project and skill custom fields render too (they carry no keywords delta —
/// both types already had `keywords`).
#[rstest]
fn test_project_and_skill_custom_fields_change_rendered_output(
    #[values("projects", "skills")] section: &str,
) {
    let renderer = TypstRenderer::new();
    let mut base = ResumeData::default();
    base.sections.projects = Section::new("projects", "Projects");
    let mut project = Project::new("Rustume").with_summary("A resume builder.");
    project.id = "proj_0".to_string();
    base.sections.projects.add_item(project);
    base.sections.skills = Section::new("skills", "Skills");
    let mut skill = Skill::new("Rust").with_level(5);
    skill.id = "skill_0".to_string();
    base.sections.skills.add_item(skill);

    // Same determinism guard as the per-field test above: these assertions
    // only mean anything while the renderer is byte-deterministic.
    let plain = renderer.render_pdf(&base).unwrap();
    assert_eq!(
        renderer.render_pdf(&base).unwrap(),
        plain,
        "PDF output is no longer byte-deterministic; rework this test's \
         comparisons instead of skipping"
    );

    let mut enriched = base;
    match section {
        "projects" => {
            enriched.sections.projects.items[0].custom_fields =
                vec![CustomField::new("Role", "Author")]
        }
        "skills" => {
            enriched.sections.skills.items[0].custom_fields = vec![CustomField::new("Years", "6")]
        }
        other => panic!("unhandled section case: {other}"),
    }

    assert_ne!(
        plain,
        renderer.render_pdf(&enriched).unwrap(),
        "custom fields have no effect on rendered '{section}' output"
    );
}

/// Serialize a value the way the engine embeds the resume JSON in the Typst
/// source: `serde_json`, then backslash and quote escaping.
fn embedded_json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value)
        .unwrap()
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
}

/// The generated Typst source must carry the new fields end-to-end so the
/// export path (which serializes stored JSON) round-trips them. The engine
/// escapes the resume JSON before embedding it, so the expectations are built
/// by applying that same escaping to the exact serialized values — a bare
/// `contains("itemBreaks")` would pass even if the ids or the mapping were
/// lost.
#[test]
fn test_generate_source_carries_item_breaks_and_custom_fields() {
    let renderer = TypstRenderer::new();
    let mut resume = resume_with_experience_items("rhyhorn", 2);
    resume
        .metadata
        .item_breaks
        .insert("experience".to_string(), vec!["exp_1".to_string()]);
    resume.sections.experience.items[0].keywords = vec!["Distributed systems".to_string()];
    let custom_field = CustomField::new("Team size", "8 engineers");
    resume.sections.experience.items[0].custom_fields = vec![custom_field.clone()];

    let source = renderer.generate_source(&resume).unwrap();

    let item_breaks = embedded_json(&serde_json::json!({ "experience": ["exp_1"] }));
    assert!(
        source.contains(&item_breaks),
        "expected itemBreaks mapping {item_breaks} in source"
    );

    let keywords = embedded_json(&serde_json::json!(["Distributed systems"]));
    assert!(
        source.contains(&keywords),
        "expected keywords {keywords} in source"
    );

    // Serialized from the struct itself, so the expectation tracks the schema's
    // field order rather than a hand-written literal that could drift.
    let custom_fields = embedded_json(&vec![custom_field]);
    assert!(
        source.contains(&custom_fields),
        "expected customFields {custom_fields} in source"
    );
}

#[rstest]
fn test_render_template_with_level_display_override(
    // rhyhorn covers the grid-cell rendering path, azurill the guarded
    // per-item rendering path shared by the other templates.
    #[values("rhyhorn", "azurill")] template_name: &str,
    #[values(
        LevelDisplay::Hidden,
        LevelDisplay::Circle,
        LevelDisplay::Square,
        LevelDisplay::ProgressBar,
        LevelDisplay::Text
    )]
    level_display: LevelDisplay,
) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.metadata.level_display = level_display;

    let result = renderer.render_pdf(&resume);
    assert!(
        result.is_ok(),
        "PDF rendering failed for template '{template_name}' with level display \
         '{level_display:?}': {:?}",
        result.err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
}

/// Every template must compile with a non-default level display so a Typst
/// syntax error in any template's override branch is caught.
#[test]
fn test_render_all_templates_with_circle_level_display() {
    let renderer = TypstRenderer::new();
    for template_name in TEMPLATES {
        let mut resume = sample_resume();
        resume.metadata.template = (*template_name).to_string();
        resume.metadata.level_display = LevelDisplay::Circle;

        let result = renderer.render_pdf(&resume);
        assert!(
            result.is_ok(),
            "PDF rendering failed for template '{template_name}' with circle level display: {:?}",
            result.err()
        );
        assert!(result.unwrap().starts_with(b"%PDF-"));
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
fn test_templates_render_non_default_layout(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.metadata.layout = vec![vec![
        vec![
            "summary".to_string(),
            "skills".to_string(),
            "projects".to_string(),
            "custom".to_string(),
        ],
        vec![
            "experience".to_string(),
            "education".to_string(),
            "profiles".to_string(),
        ],
    ]];
    resume.sections.profiles.visible = true;

    let result = renderer.render_pdf(&resume);

    assert!(
        result.is_ok(),
        "PDF rendering failed for non-default layout in '{template_name}': {:?}",
        result.err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
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
fn test_templates_render_custom_sections(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["skills".to_string(), "custom".to_string()],
    ]];

    let mut custom_section = Section::new("open-source", "Open Source");
    let mut custom_item = CustomItem::new("Rustume");
    custom_item.description = "Maintained Typst template rendering".to_string();
    custom_item.summary = "Built shared rendering contracts for all templates.".to_string();
    custom_section.add_item(custom_item);
    resume.sections.custom = HashMap::from([("open-source".to_string(), custom_section)]);

    let result = renderer.render_pdf(&resume);

    assert!(
        result.is_ok(),
        "PDF rendering failed for custom sections in '{template_name}': {:?}",
        result.err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
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
fn test_templates_render_multi_page_content(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.sections.experience = Section::new("experience", "Experience");
    for i in 0..30 {
        resume.sections.experience.add_item(
            Experience::new(format!("Company {}", i), format!("Position {}", i))
                .with_summary("Owned planning, implementation, testing, and rollout for complex template rendering work across multiple resume sections."),
        );
    }

    let result = renderer.render_preview(&resume, 0);

    assert!(
        result.is_ok(),
        "Preview rendering failed for multi-page content in '{template_name}': {:?}",
        result.err()
    );
    let (_, total_pages) = result.unwrap();
    assert!(
        total_pages > 1,
        "Expected '{template_name}' to render more than one page"
    );
}

/// Populate the sample resume's cover letter with recipient and body content.
fn fill_cover_letter(resume: &mut ResumeData, visible: bool) {
    resume.sections.cover_letter.visible = visible;
    resume.sections.cover_letter.recipient.name = "Jane Smith".to_string();
    resume.sections.cover_letter.recipient.title = "Hiring Manager".to_string();
    resume.sections.cover_letter.recipient.company = "Acme Corp".to_string();
    resume.sections.cover_letter.recipient.address = "123 Main St, San Francisco, CA".to_string();
    resume.sections.cover_letter.recipient.email = "jane@acme.com".to_string();
    resume.sections.cover_letter.content =
        "<p>Dear Jane,</p><p>I am <strong>excited</strong> to apply for the Senior Software \
         Engineer role at Acme Corp. My experience building scalable systems aligns closely \
         with your team's mission.</p><p>Sincerely,<br>John Doe</p>"
            .to_string();
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
fn test_templates_render_cover_letter_as_dedicated_page(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    // Baseline: cover letter data present but not visible.
    let mut without = sample_resume();
    without.metadata.template = template_name.to_string();
    fill_cover_letter(&mut without, false);
    let (base_page_0, base_pages) = renderer
        .render_preview(&without, 0)
        .unwrap_or_else(|e| panic!("Baseline preview failed for '{template_name}': {e:?}"));

    // With a visible cover letter, exactly one extra page renders in front.
    let mut with = sample_resume();
    with.metadata.template = template_name.to_string();
    fill_cover_letter(&mut with, true);
    let (with_page_0, pages) = renderer
        .render_preview(&with, 0)
        .unwrap_or_else(|e| panic!("Cover letter preview failed for '{template_name}': {e:?}"));

    assert_eq!(
        pages,
        base_pages + 1,
        "Expected '{template_name}' to render the cover letter as exactly one dedicated \
         extra page (baseline {base_pages} pages, got {pages})"
    );

    // Ordering: the cover letter is prepended, so page 1 of the cover letter
    // render must match page 0 of the baseline resume pixel-for-pixel, and
    // page 0 must differ from the baseline first page.
    let (with_page_1, _) = renderer
        .render_preview(&with, 1)
        .unwrap_or_else(|e| panic!("Second-page preview failed for '{template_name}': {e:?}"));
    assert_ne!(
        with_page_0, base_page_0,
        "Expected the first page of '{template_name}' to be the cover letter, \
         not the resume"
    );
    assert_eq!(
        with_page_1, base_page_0,
        "Expected the resume to start on page 2 in '{template_name}' when the \
         cover letter is visible"
    );
}

#[rstest]
#[case("rhyhorn")]
#[case("azurill")]
fn test_cover_letter_not_placed_in_layout_is_skipped(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    // Visible cover letter, but an explicit layout that omits "coverLetter".
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    fill_cover_letter(&mut resume, true);
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];
    let (_, pages) = renderer
        .render_preview(&resume, 0)
        .unwrap_or_else(|e| panic!("Preview failed for '{template_name}': {e:?}"));

    // Same layout without any cover letter data.
    let mut baseline = sample_resume();
    baseline.metadata.template = template_name.to_string();
    baseline.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];
    let (_, base_pages) = renderer
        .render_preview(&baseline, 0)
        .unwrap_or_else(|e| panic!("Baseline preview failed for '{template_name}': {e:?}"));

    assert_eq!(
        pages, base_pages,
        "Cover letter absent from layout must not add pages in '{template_name}'"
    );
}

#[rstest]
#[case("rhyhorn")]
#[case("azurill")]
fn test_cover_letter_on_later_layout_page_renders_dedicated_page(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    // The renderer now consumes every layout page, so a cover letter placed on
    // a later layout page is still hoisted into its dedicated leading page.
    // The layout page that holds only "coverLetter" must not additionally emit
    // a blank resume page.
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    fill_cover_letter(&mut resume, true);
    resume.metadata.layout = vec![
        vec![
            vec!["summary".to_string(), "experience".to_string()],
            vec!["education".to_string(), "skills".to_string()],
        ],
        vec![vec!["coverLetter".to_string()]],
    ];
    let (_, pages) = renderer
        .render_preview(&resume, 0)
        .unwrap_or_else(|e| panic!("Preview failed for '{template_name}': {e:?}"));

    let mut baseline = sample_resume();
    baseline.metadata.template = template_name.to_string();
    baseline.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];
    let (_, base_pages) = renderer
        .render_preview(&baseline, 0)
        .unwrap_or_else(|e| panic!("Baseline preview failed for '{template_name}': {e:?}"));

    assert_eq!(
        pages,
        base_pages + 1,
        "Cover letter on a later layout page must add exactly its dedicated page in \
         '{template_name}'"
    );
}

#[rstest]
#[case("rhyhorn")]
#[case("azurill")]
fn test_cover_letter_placed_in_layout_column_renders_once(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();

    // "coverLetter" placed among other sections in a layout column: it must
    // render as a dedicated page (hoisted before the resume body), not inline.
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    fill_cover_letter(&mut resume, true);
    resume.metadata.layout = vec![vec![
        vec![
            "summary".to_string(),
            "coverLetter".to_string(),
            "experience".to_string(),
        ],
        vec!["education".to_string(), "skills".to_string()],
    ]];
    let (_, pages) = renderer
        .render_preview(&resume, 0)
        .unwrap_or_else(|e| panic!("Preview failed for '{template_name}': {e:?}"));

    let mut baseline = sample_resume();
    baseline.metadata.template = template_name.to_string();
    baseline.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];
    let (_, base_pages) = renderer
        .render_preview(&baseline, 0)
        .unwrap_or_else(|e| panic!("Baseline preview failed for '{template_name}': {e:?}"));

    assert_eq!(
        pages,
        base_pages + 1,
        "Cover letter placed in a layout column must add exactly one page in '{template_name}'"
    );
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
fn test_cover_letter_only_layout_renders_single_page(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    fill_cover_letter(&mut resume, true);
    resume.metadata.layout = vec![vec![vec!["coverLetter".to_string()]]];

    let (_, pages) = renderer.render_preview(&resume, 0).unwrap_or_else(|e| {
        panic!("Cover-letter-only preview failed for '{template_name}': {e:?}")
    });

    assert_eq!(
        pages, 1,
        "Cover-letter-only layout must not render a trailing resume page in '{template_name}'"
    );
}

#[test]
fn test_cover_letter_source_contains_converted_markup() {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    fill_cover_letter(&mut resume, true);

    let source = renderer
        .generate_source(&resume)
        .expect("source generation should succeed");

    assert!(
        !source.contains("<strong>"),
        "Cover letter HTML must be converted to Typst markup before embedding"
    );
    assert!(
        source.contains("excited"),
        "Cover letter body text must be preserved through conversion"
    );
}

/// Compile-only smoke test for the shared `render-picture` helper: a resume
/// with rotation, shadow, and border effects set must still render to a PDF.
#[test]
fn test_render_picture_effects_smoke() {
    // Minimal 1x1 transparent PNG as a data URL.
    let png_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = "bronzor".to_string();
    resume.basics.picture = Picture::new(png_data_url);
    resume.basics.picture.effects = PictureEffects {
        border: true,
        rotation: 15.0,
        border_color: "#0891b2".to_string(),
        border_width: 3,
        shadow_size: 8,
        ..Default::default()
    };

    let result = renderer.render_pdf(&resume);
    assert!(
        result.is_ok(),
        "PDF rendering failed with picture effects: {:?}",
        result.err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
}

/// Remote picture URLs must not fail the entire PDF render (#738).
#[test]
fn test_remote_picture_url_still_renders_pdf() {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.basics.picture = Picture::new("https://example.com/photo.jpg");

    let result = renderer.render_pdf(&resume);
    assert!(
        result.is_ok(),
        "PDF rendering failed with a remote picture URL: {:?}",
        result.err()
    );
    assert!(result.unwrap().starts_with(b"%PDF-"));
}

#[test]
fn test_templates_use_shared_render_contract() {
    let template_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("typst_engine")
        .join("templates");

    for entry in fs::read_dir(&template_dir)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", template_dir.display()))
    {
        let path = entry.expect("template dir entry should be readable").path();
        if path.file_name().and_then(|name| name.to_str()) == Some("_common.typ") {
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) != Some("typ") {
            continue;
        }

        let contents = fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("Failed to read {}: {e}", path.display()));
        assert!(
            contents.contains("render-resume(data,"),
            "{} must render through _common.typ::render-resume",
            path.display()
        );
        assert!(
            !contents.contains("data.metadata.layout"),
            "{} must not read layout metadata directly",
            path.display()
        );
        // Item-level visibility checks such as `item.visible` are allowed, but
        // templates must not orchestrate section visibility via
        // `data.sections.<...>.visible`.
        assert!(
            !(contents.contains("data.sections.") && contents.contains(".visible")),
            "{} must not orchestrate section visibility directly",
            path.display()
        );
        assert!(
            !contents.contains("layout-column-sections(")
                && !contents.contains("layout-all-sections("),
            "{} must not resolve layout sections directly",
            path.display()
        );
        assert!(
            contents.contains("render-profile-entry("),
            "{} must render profiles through _common.typ::render-profile-entry",
            path.display()
        );
        assert!(
            contents.contains("avatar-above(") || contents.contains("avatar-beside("),
            "{} must place the avatar through avatar-above/avatar-beside so a \
             direct render-avatar call cannot hide an empty reserved slot (#857)",
            path.display()
        );
    }
}

/// Sidebar templates must keep section titles on one line via the shared
/// heading helper (#826). Contact / Interests otherwise wrap mid-word.
#[rstest]
#[case("pikachu")]
#[case("azurill")]
#[case("ditto")]
#[case("chikorita")]
#[case("gengar")]
#[case("glalie")]
fn test_sidebar_templates_use_heading_label(#[case] template_name: &str) {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("typst_engine")
        .join("templates")
        .join(format!("{template_name}.typ"));
    let contents = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", path.display()));
    assert!(
        contents.contains("heading-label("),
        "{template_name} must keep sidebar titles on one line via heading-label"
    );
}

/// Extract the argument list of the first `set page(...)` call in a template,
/// balancing nested parentheses so multi-line and nested calls survive.
fn set_page_arguments(contents: &str) -> Option<&str> {
    let start = contents.find("set page(")? + "set page(".len();
    let rest = &contents[start..];
    let mut depth = 1_usize;
    for (idx, ch) in rest.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&rest[..idx]);
                }
            }
            _ => {}
        }
    }
    None
}

/// Every template must paint `data.metadata.theme.background` onto the page.
///
/// Regression guard for #650: `glalie` bound `bg-color` but never passed it to
/// `set page`, so a themed background was silently discarded in one of the
/// twelve templates. Asserting the invariant across all templates is what
/// would have caught the drift.
#[test]
fn test_templates_apply_themed_page_background() {
    let template_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("typst_engine")
        .join("templates");

    for template in TEMPLATES {
        let path = template_dir.join(format!("{template}.typ"));
        let contents = fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("Failed to read {}: {e}", path.display()));

        assert!(
            contents.contains(r#"let bg-color = rgb(data.metadata.theme.at("background""#),
            "{template} must bind bg-color from data.metadata.theme.background"
        );

        let page_arguments = set_page_arguments(&contents)
            .unwrap_or_else(|| panic!("{template} must configure the page with `set page(...)`"));
        assert!(
            page_arguments.contains("fill: bg-color"),
            "{template} must apply the themed page background via \
             `set page(fill: bg-color, ...)`; without it a themed \
             data.metadata.theme.background is silently ignored"
        );
    }
}

/// The themed background must also survive the Rust → Typst hand-off: the
/// generated source embeds the resume JSON, so the configured colour has to
/// reach the template that paints it.
#[test]
fn test_generate_source_carries_themed_background() {
    let renderer = TypstRenderer::new();

    for template in TEMPLATES {
        let mut resume = sample_resume();
        resume.metadata.template = (*template).to_string();
        resume.metadata.theme.background = "#e7e5e4".to_string();

        let source = renderer
            .generate_source(&resume)
            .unwrap_or_else(|e| panic!("source generation failed for '{template}': {e:?}"));

        assert!(
            source.contains("#e7e5e4"),
            "generated source for '{template}' must carry the themed background colour"
        );
    }
}

#[test]
fn test_common_defines_profile_icon_helpers() {
    let common = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("typst_engine")
        .join("templates")
        .join("_common.typ");
    let contents = fs::read_to_string(&common)
        .unwrap_or_else(|e| panic!("Failed to read {}: {e}", common.display()));

    for needle in [
        "profile-icon-key",
        "profile-icon-asset",
        "profile-icon-mark",
        "render-profile-icon",
        "render-profile-entry",
        "typography-hide-icons",
        "typography-underline-links",
        "/assets/icons/",
        "sidebar-page-rail",
        "heading-label",
    ] {
        assert!(
            contents.contains(needle),
            "_common.typ must define {needle}"
        );
    }
}

#[rstest]
#[case("pikachu")]
#[case("onyx")]
#[case("gengar")]
#[case("azurill")]
fn test_templates_render_profiles_with_links(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.metadata.typography.hide_icons = false;
    resume.metadata.typography.underline_links = true;
    resume.sections.profiles = Section::new("profiles", "Profiles");
    resume.sections.profiles.visible = true;
    resume.sections.profiles.add_item(
        Profile::new("GitHub", "johndoe")
            .with_url("https://github.com/johndoe")
            .with_icon("github"),
    );
    resume.sections.profiles.add_item(
        Profile::new("LinkedIn", "john-doe")
            .with_url("https://linkedin.com/in/john-doe")
            .with_icon("linkedin"),
    );

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|err| panic!("PDF render failed for '{template_name}': {err:?}"));

    assert!(pdf.starts_with(b"%PDF-"));
    let pdf_str = String::from_utf8_lossy(&pdf);
    assert!(
        pdf_str.contains("https://github.com/johndoe"),
        "PDF for '{template_name}' should embed the GitHub profile URL"
    );
    assert!(
        pdf_str.contains("https://linkedin.com/in/john-doe"),
        "PDF for '{template_name}' should embed the LinkedIn profile URL"
    );
}

// ============================================================================
// Content-Level PDF Assertions (multi-page layouts, doc-editor parity)
// ============================================================================

/// Extract the text of every PDF page, in page order.
fn extract_pdf_pages_text(pdf: &[u8]) -> Vec<String> {
    pdf_extract::extract_text_from_mem_by_pages(pdf)
        .expect("rendered PDF should yield extractable text")
}

/// Index of the first page whose extracted text contains `needle`.
fn page_index_containing(pages: &[String], needle: &str) -> Option<usize> {
    pages.iter().position(|text| text.contains(needle))
}

/// Chikorita's tinted sidebar used to wrap in an unbreakable `box`, which
/// shoved the entire two-column grid onto page 2 and left page 1 as header
/// only (#855). Body content must start on page 1 for the doc-editor fixture.
#[test]
fn test_chikorita_doc_editor_body_starts_on_page_1() {
    let data = fs::read(fixtures_path().join("v3").join("doc-editor.json"))
        .expect("Failed to read doc-editor fixture");
    let mut resume = ReactiveResumeV3Parser
        .parse(&data)
        .expect("Failed to parse doc-editor fixture");
    resume.metadata.template = "chikorita".to_string();
    let theme = get_template_theme("chikorita");
    resume.metadata.theme.primary = theme.primary;
    resume.metadata.theme.text = theme.text;
    resume.metadata.theme.background = theme.background;

    let pdf = TypstRenderer::new()
        .render_pdf(&resume)
        .expect("chikorita doc-editor fixture should render");
    let pages = extract_pdf_pages_text(&pdf);
    assert!(
        !pages.is_empty(),
        "chikorita must render at least one PDF page"
    );
    let first = &pages[0];
    assert!(
        first.contains("Mireille Okafor"),
        "page 1 should carry the header, got:\n{first}"
    );
    for needle in ["Lumen Health", "Design Tokens", "EXPERIENCE"] {
        assert!(
            first.contains(needle),
            "chikorita page 1 must contain body content '{needle}' (not header-only), got:\n{first}"
        );
    }
}

/// The doc-editor fixture declares a two-page `metadata.layout` on a sidebar
/// template (`ditto`). The rendered PDF must carry the content of BOTH layout
/// pages — sidebar sections, project highlights, and the sections placed on
/// layout page 2 — and layout page 2 must start on a later PDF page.
#[test]
fn test_doc_editor_fixture_renders_both_layout_pages_with_content() {
    let data = fs::read(fixtures_path().join("v3").join("doc-editor.json"))
        .expect("Failed to read doc-editor fixture");
    let resume = ReactiveResumeV3Parser
        .parse(&data)
        .expect("Failed to parse doc-editor fixture");
    assert!(
        resume.metadata.layout.len() >= 2,
        "fixture should declare a multi-page layout"
    );

    let pdf = TypstRenderer::new()
        .render_pdf(&resume)
        .expect("doc-editor fixture should render");
    let pages = extract_pdf_pages_text(&pdf);
    assert!(
        pages.len() >= 2,
        "a two-page layout must render at least two PDF pages, got {}",
        pages.len()
    );

    // Layout page 0, sidebar column: profiles and skills open on the first
    // page; the "speaking" custom section may flow onto a continuation page
    // but must render before the sections placed on layout page 2.
    // Profile labels are username-first (#829), so assert the Mastodon
    // username rather than the network name.
    let first = &pages[0];
    for needle in ["mireille@front-end.social", "Design Tokens"] {
        assert!(
            first.contains(needle),
            "first page should carry sidebar content '{needle}', got:\n{first}"
        );
    }
    // Section headings render uppercased in ditto, so match the styled form.
    let speaking_page = page_index_containing(&pages, "WORKSHOPS")
        .expect("custom sidebar section 'Talks & Workshops' missing from every page");
    let page_two_start = page_index_containing(&pages, "Igbo")
        .expect("layout page 2 languages content missing from every page");
    assert!(
        speaking_page < page_two_start,
        "layout page 1 sidebar content must render before layout page 2 sections \
         (speaking on {speaking_page}, layout page 2 on {page_two_start})"
    );

    // The fixture's "advisory" custom section is visible: false — it must
    // stay out of the output even though the layout references it.
    assert!(
        page_index_containing(&pages, "ADVISORY").is_none(),
        "hidden custom section 'Advisory' must not render"
    );

    // Layout page 0, main column: project name and a summary highlight.
    let project_page = page_index_containing(&pages, "Contrastly")
        .expect("project name 'Contrastly' missing from every page");
    let highlight_page = page_index_containing(&pages, "spreadsheet")
        .expect("project highlight bullet missing from every page");
    assert_eq!(
        project_page, highlight_page,
        "project highlights should render with the project entry"
    );

    // Layout page 1 content must exist and start after layout page 0 content.
    for needle in ["Letterpress", "Igbo", "Scrum"] {
        let idx = page_index_containing(&pages, needle)
            .unwrap_or_else(|| panic!("layout page 2 content '{needle}' missing from every page"));
        assert!(
            idx > 0,
            "layout page 2 content '{needle}' must not render on the first PDF page"
        );
        assert!(
            idx >= project_page,
            "layout page 2 content '{needle}' must render after layout page 1 content"
        );
    }
}

/// A second explicit layout page adds exactly one rendered page and its
/// sections land on that page — across the three grid strategies (single
/// column, fixed sidebar, proportional two-column).
#[rstest]
#[case("rhyhorn")]
#[case("pikachu")]
#[case("leafish")]
fn test_second_layout_page_adds_a_page_with_its_sections(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let page_one_layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];

    let mut base = sample_resume();
    base.metadata.template = template_name.to_string();
    base.metadata.layout = page_one_layout.clone();
    let (_, base_pages) = renderer
        .render_preview(&base, 0)
        .unwrap_or_else(|e| panic!("baseline preview failed for '{template_name}': {e:?}"));

    let mut multi = sample_resume();
    multi.metadata.template = template_name.to_string();
    multi.sections.awards = Section::new("awards", "Awards");
    multi.sections.awards.add_item(
        Award::new("Golden Crab Trophy")
            .with_awarder("Crustacean Society")
            .with_date("2024"),
    );
    let mut layout = page_one_layout;
    layout.push(vec![vec!["awards".to_string()], vec![]]);
    multi.metadata.layout = layout;

    let (_, pages) = renderer
        .render_preview(&multi, 0)
        .unwrap_or_else(|e| panic!("multi-page preview failed for '{template_name}': {e:?}"));
    assert_eq!(
        pages,
        base_pages + 1,
        "second layout page should add exactly one page for '{template_name}'"
    );

    let pdf = renderer
        .render_pdf(&multi)
        .unwrap_or_else(|e| panic!("multi-page PDF failed for '{template_name}': {e:?}"));
    let texts = extract_pdf_pages_text(&pdf);
    let award_page = page_index_containing(&texts, "Golden Crab Trophy").unwrap_or_else(|| {
        panic!("award placed on layout page 2 missing from every page in '{template_name}'")
    });
    assert_eq!(
        award_page,
        texts.len() - 1,
        "layout page 2 sections should render on the final page for '{template_name}'"
    );
    assert!(
        texts[0].contains("Acme Corp"),
        "layout page 1 sections should stay on the first page for '{template_name}'"
    );
}

/// An empty trailing layout page (all columns empty) must not emit a blank
/// PDF page.
#[test]
fn test_empty_trailing_layout_page_adds_no_page() {
    let renderer = TypstRenderer::new();
    let base_layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];

    let mut base = sample_resume();
    base.metadata.layout = base_layout.clone();
    let (_, base_pages) = renderer.render_preview(&base, 0).expect("baseline preview");

    let mut padded = sample_resume();
    let mut layout = base_layout;
    layout.push(vec![vec![], vec![]]);
    padded.metadata.layout = layout;
    let (_, pages) = renderer.render_preview(&padded, 0).expect("padded preview");

    assert_eq!(pages, base_pages, "empty layout page must not add a page");
}

/// A trailing layout page whose sections are all hidden draws nothing, so it
/// must not emit a styled blank page either (visibility-aware
/// `layout-page-has-content`).
#[test]
fn test_hidden_only_trailing_layout_page_adds_no_page() {
    let renderer = TypstRenderer::new();
    let base_layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["education".to_string(), "skills".to_string()],
    ]];

    let mut base = sample_resume();
    base.metadata.layout = base_layout.clone();
    base.sections.interests.visible = false;
    let (_, base_pages) = renderer.render_preview(&base, 0).expect("baseline preview");

    let mut padded = base.clone();
    let mut layout = base_layout;
    layout.push(vec![vec!["interests".to_string()], vec![]]);
    padded.metadata.layout = layout;
    let (_, pages) = renderer.render_preview(&padded, 0).expect("padded preview");

    assert_eq!(
        pages, base_pages,
        "a layout page holding only hidden sections must not add a page"
    );
}

/// Contact rows render through the bundled-SVG icon mechanism now — the
/// extracted text must carry the plain contact values with no emoji glyphs
/// (✉ ☎ 📍 🔗 rendered as tofu boxes when the font lacks them).
#[rstest]
#[case("pikachu")]
#[case("nosepass")]
fn test_contact_rows_render_without_emoji_glyphs(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.basics.url.href = "https://johndoe.dev".to_string();

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");

    for needle in ["john@example.com", "+1-555-123-4567", "San Francisco, CA"] {
        assert!(
            text.contains(needle),
            "contact value '{needle}' missing for '{template_name}':\n{text}"
        );
    }
    for glyph in ["✉", "☎", "📍", "🔗"] {
        assert!(
            !text.contains(glyph),
            "emoji contact glyph '{glyph}' should be gone from '{template_name}'"
        );
    }
}

/// Field parity: skill description/keywords, education summary, project
/// summary (#700), and interest keywords must reach the extracted PDF text on
/// the templates that previously dropped them. Also asserts item-presentation
/// composition (#829): education degree-first with `institution · area`, no
/// `" in "` join, and profile labels username-first.
#[rstest]
#[case("pikachu")]
#[case("nosepass")]
#[case("rhyhorn")]
#[case("chikorita")]
#[case("ditto")]
#[case("glalie")]
#[case("azurill")]
#[case("bronzor")]
#[case("gengar")]
#[case("kakuna")]
#[case("leafish")]
#[case("onyx")]
fn test_parity_fields_reach_pdf_text(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();

    resume.sections.skills = Section::new("skills", "Skills");
    let mut skill = Skill::new("Rust")
        .with_level(5)
        .with_keywords(vec!["Tokio".to_string(), "Typst".to_string()]);
    skill.description = "Daily driver since 2019".to_string();
    resume.sections.skills.add_item(skill);

    resume.sections.education.items[0].summary = "Thesis on distributed consensus".to_string();

    resume.sections.projects = Section::new("projects", "Projects");
    resume
        .sections
        .projects
        .add_item(Project::new("Rustume").with_summary("Shipped the multi-page layout engine"));

    resume.sections.interests = Section::new("interests", "Interests");
    resume.sections.interests.visible = true;
    let mut interest = rustume_schema::Interest::new("Orienteering");
    interest.keywords = vec!["Night navigation".to_string()];
    resume.sections.interests.add_item(interest);

    resume.sections.profiles = Section::new("profiles", "Profiles");
    resume.sections.profiles.visible = true;
    resume.sections.profiles.add_item(
        rustume_schema::Profile::new("GitHub", "TurboCoder13")
            .with_url("https://github.com/TurboCoder13"),
    );

    resume.metadata.layout = vec![vec![
        vec![
            "summary".to_string(),
            "experience".to_string(),
            "education".to_string(),
            "projects".to_string(),
        ],
        vec![
            "profiles".to_string(),
            "skills".to_string(),
            "interests".to_string(),
        ],
    ]];

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");

    for needle in [
        "Daily driver since 2019",
        "Tokio",
        "Thesis on distributed consensus",
        "Shipped the multi-page layout engine",
        "Night navigation",
        // Education composition (#829): degree, then institution · area.
        "Bachelor of Science",
        "MIT · Computer Science",
        // Profile label (#829): username, not network name alone.
        "TurboCoder13",
    ] {
        assert!(
            text.contains(needle),
            "parity field '{needle}' missing from '{template_name}' output:\n{text}"
        );
    }

    assert!(
        !text.contains("Bachelor of Science in Computer Science"),
        "education must not join studyType and area with 'in' on '{template_name}':\n{text}"
    );

    // Username-first means no network-prefixed label; "GitHub: TurboCoder13"
    // would also satisfy the positive TurboCoder13 needle above.
    assert!(
        !text.contains("GitHub: TurboCoder13"),
        "profile label must be username-first, not network-username, on '{template_name}':\n{text}"
    );
}

/// Experience composition (#858): every template leads with position, then
/// company. Unique strings so volunteer/education cannot satisfy the needles.
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
fn test_experience_items_are_position_first(#[case] template_name: &str) {
    const POSITION_1: &str = "Lead Reliability Architect";
    const COMPANY_1: &str = "Helios Gridworks Ltd";
    const POSITION_2: &str = "Staff Compiler Engineer";
    const COMPANY_2: &str = "Umber Foundry Co";

    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.sections.experience = Section::new("experience", "Experience");
    resume.sections.experience.add_item(
        Experience::new(COMPANY_1, POSITION_1)
            .with_location("Lisbon, PT")
            .with_date("2021 - Present")
            .with_summary("Ran the on-call rotation."),
    );
    resume.sections.experience.add_item(
        Experience::new(COMPANY_2, POSITION_2)
            .with_location("Austin, TX")
            .with_date("2017 - 2021")
            .with_summary("Shipped the frontend compiler."),
    );
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec![],
    ]];

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");

    for (position, company) in [(POSITION_1, COMPANY_1), (POSITION_2, COMPANY_2)] {
        let pos = text.find(position).unwrap_or_else(|| {
            panic!("position '{position}' missing from '{template_name}' PDF text:\n{text}")
        });
        let co = text.find(company).unwrap_or_else(|| {
            panic!("company '{company}' missing from '{template_name}' PDF text:\n{text}")
        });
        assert!(
            pos < co,
            "experience must be position-first on '{template_name}': \
             '{position}' at {pos} must precede '{company}' at {co}:\n{text}"
        );
    }
}

const PHOTOLESS_INITIALS_NAME: &str = "Zelda Quince";
const PHOTOLESS_INITIALS: &str = "ZQ";

fn photoless_resume(template_name: &str, show_initials: bool) -> ResumeData {
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.basics.name = PHOTOLESS_INITIALS_NAME.to_string();
    resume.basics.picture = Picture::default();
    resume.basics.picture.effects.show_initials = show_initials;
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec![],
    ]];
    resume
}

/// Photo-less default (#857): initials must not appear in extracted PDF text.
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
fn test_photoless_default_omits_initials_from_pdf(#[case] template_name: &str) {
    let pdf = TypstRenderer::new()
        .render_pdf(&photoless_resume(template_name, false))
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");
    assert!(
        text.contains(PHOTOLESS_INITIALS_NAME),
        "name should still render on '{template_name}':\n{text}"
    );
    assert!(
        !text.contains(PHOTOLESS_INITIALS),
        "photo-less default must not print initials '{PHOTOLESS_INITIALS}' on '{template_name}':\n{text}"
    );
}

/// Photo-less opt-in (#857): initials disc must reach extracted PDF text.
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
fn test_photoless_opt_in_prints_initials_on_pdf(#[case] template_name: &str) {
    let pdf = TypstRenderer::new()
        .render_pdf(&photoless_resume(template_name, true))
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");
    assert!(
        text.contains(PHOTOLESS_INITIALS),
        "opt-in initials '{PHOTOLESS_INITIALS}' missing from '{template_name}':\n{text}"
    );
}

// ============================================================================
// #826 sidebar rail + title nowrap (parity-harness item 6 does not yet
// sample colours; these focused render tests document the contract)
// ============================================================================

/// Long main column, short sidebar — the grid-cell fill used to die after
/// Interests while the main column continued on white.
fn long_main_short_sidebar(template_name: &str) -> ResumeData {
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    let theme = get_template_theme(template_name);
    resume.metadata.theme.primary = theme.primary;
    resume.metadata.theme.text = theme.text;
    resume.metadata.theme.background = theme.background;

    resume.sections.experience = Section::new("experience", "Experience");
    for i in 0..28 {
        resume.sections.experience.add_item(
            Experience::new(format!("Company {i}"), format!("Position {i}")).with_summary(
                "Owned planning, implementation, testing, and rollout for complex \
                 template rendering work across multiple resume sections.",
            ),
        );
    }

    resume.sections.interests = Section::new("interests", "Interests");
    resume.sections.interests.visible = true;
    resume
        .sections
        .interests
        .add_item(rustume_schema::Interest::new("Orienteering"));

    resume.sections.skills.visible = false;
    resume.sections.profiles.visible = false;
    resume.metadata.layout = vec![vec![
        vec![
            "summary".to_string(),
            "experience".to_string(),
            "education".to_string(),
        ],
        vec!["interests".to_string()],
    ]];
    resume
}

fn png_rgba(png: &[u8]) -> image::RgbaImage {
    image::load_from_memory(png)
        .expect("preview PNG should decode")
        .to_rgba8()
}

fn pixel_at(img: &image::RgbaImage, x: u32, y: u32) -> [u8; 4] {
    img.get_pixel(x, y).0
}

fn is_near_white(px: [u8; 4]) -> bool {
    px[0] > 248 && px[1] > 248 && px[2] > 248
}

fn max_channel_delta(a: [u8; 4], b: [u8; 4]) -> u8 {
    (0..3).map(|i| a[i].abs_diff(b[i])).max().unwrap_or(0)
}

/// #826: the sidebar tint must reach the bottom of page 1 *and* of a
/// continuation page whose sidebar content ended earlier. Sampled at 1 px/pt
/// so x/y map 1:1 onto the template's point widths.
#[rstest]
#[case("pikachu", 180)]
#[case("gengar", 170)]
#[case("glalie", 170)]
#[case("ditto", 160)]
fn test_sidebar_tint_reaches_page_bottom_on_continuation(
    #[case] template_name: &str,
    #[case] sidebar_width_pt: u32,
) {
    let resume = long_main_short_sidebar(template_name);
    let renderer = TypstRenderer::new();
    let (page0, pages) = renderer
        .render_preview_at(&resume, 0, 1.0)
        .unwrap_or_else(|e| panic!("page 0 preview failed for '{template_name}': {e:?}"));
    assert!(
        pages >= 2,
        "'{template_name}' must overflow onto a continuation page, got {pages}"
    );
    let (page1, _) = renderer
        .render_preview_at(&resume, 1, 1.0)
        .unwrap_or_else(|e| panic!("page 1 preview failed for '{template_name}': {e:?}"));

    let img0 = png_rgba(&page0);
    let img1 = png_rgba(&page1);
    let (width, height) = (img0.width(), img0.height());
    assert_eq!(
        (img1.width(), img1.height()),
        (width, height),
        "preview pages should share dimensions"
    );

    let sidebar_x = sidebar_width_pt / 2;
    let main_x = sidebar_width_pt + 80;
    let bottom_y = height.saturating_sub(24);
    // Below a full-width header (ditto banner) / photo, still in the rail.
    let mid_y = height * 2 / 3;

    assert!(
        sidebar_x < width && main_x < width,
        "sample x out of range on '{template_name}' ({width}×{height})"
    );

    for (label, img) in [("page 0", &img0), ("page 1", &img1)] {
        let rail_mid = pixel_at(img, sidebar_x, mid_y);
        let rail_bottom = pixel_at(img, sidebar_x, bottom_y);
        let main_bottom = pixel_at(img, main_x, bottom_y);

        assert!(
            !is_near_white(rail_mid),
            "{label} mid-sidebar should be tinted on '{template_name}', got {rail_mid:?}"
        );
        assert!(
            !is_near_white(rail_bottom),
            "{label} bottom-of-page sidebar should be tinted on '{template_name}' \
             (content-height fill dies after Interests), got {rail_bottom:?}"
        );
        assert!(
            max_channel_delta(rail_mid, rail_bottom) <= 24,
            "{label} sidebar bottom should match the mid-rail tint on '{template_name}': \
             mid {rail_mid:?} vs bottom {rail_bottom:?}"
        );
        assert!(
            is_near_white(main_bottom),
            "{label} main column bottom should stay the page background on \
             '{template_name}', got {main_bottom:?}"
        );
    }
}

/// #826: CONTACT / INTERESTS must stay intact in extracted PDF text.
/// Hyphenation + tracking otherwise yields CON TACT / IN TERESTS.
#[rstest]
#[case("pikachu")]
#[case("azurill")]
#[case("ditto")]
#[case("chikorita")]
#[case("gengar")]
fn test_sidebar_titles_stay_on_one_line(#[case] template_name: &str) {
    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.sections.interests = Section::new("interests", "Interests");
    resume.sections.interests.visible = true;
    resume
        .sections
        .interests
        .add_item(rustume_schema::Interest::new("Orienteering"));
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["interests".to_string()],
    ]];

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));
    let text = extract_pdf_pages_text(&pdf).join("\n");

    assert!(
        text.contains("INTERESTS"),
        "uppercase Interests heading missing from '{template_name}':\n{text}"
    );
    for broken in ["IN TERESTS", "IN-TERESTS", "CON TACT", "CON-TACT"] {
        assert!(
            !text.contains(broken),
            "sidebar title wrapped mid-word as '{broken}' on '{template_name}':\n{text}"
        );
    }
}

/// Custom-section items carry a `{ label, href }` URL. The visible link text
/// must be the label whenever it is non-empty, and fall back to the raw href
/// only when the label is empty — matching the built-in sections (#919).
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
fn test_custom_section_item_url_prefers_label_over_href(#[case] template_name: &str) {
    const LABEL: &str = "lgtm-hq/ai-skills";
    const LABELED_HREF: &str = "https://github.com/lgtm-hq/ai-skills";
    const BARE_HREF: &str = "https://rustume.dev/unlabeled";

    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    // Second column is the sidebar on the two-column templates (#919 repro).
    resume.metadata.layout = vec![vec![
        vec!["summary".to_string(), "experience".to_string()],
        vec!["custom".to_string()],
    ]];

    let mut custom_section = Section::new("open-source", "Open Source");
    let mut labeled = CustomItem::new("AI Skills");
    labeled.url = Url::with_label(LABEL, LABELED_HREF);
    custom_section.add_item(labeled);
    let mut unlabeled = CustomItem::new("Unlabeled Project");
    unlabeled.url = Url::new(BARE_HREF);
    custom_section.add_item(unlabeled);
    resume.sections.custom = HashMap::from([("open-source".to_string(), custom_section)]);

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));

    // Line wrapping in a narrow sidebar splits the text across lines, so
    // compare with whitespace removed.
    let text = extract_pdf_pages_text(&pdf).join("\n");
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();

    assert!(
        compact.contains(LABEL),
        "'{template_name}' should render the URL label as link text, got:\n{text}"
    );
    assert!(
        !compact.contains(LABELED_HREF),
        "'{template_name}' should not print the raw href when a label exists, got:\n{text}"
    );
    assert!(
        compact.contains(BARE_HREF),
        "'{template_name}' should fall back to the href when the label is empty, got:\n{text}"
    );

    // The hyperlink destination stays the href for both items.
    let pdf_str = String::from_utf8_lossy(&pdf);
    for href in [LABELED_HREF, BARE_HREF] {
        assert!(
            pdf_str.contains(href),
            "'{template_name}' should keep '{href}' as the link target"
        );
    }
}

/// A profile with neither username nor network falls back to its URL. That
/// fallback prefers the URL label over the raw href, and still prints the href
/// when no label is set (#919).
#[rstest]
#[case("pikachu")]
#[case("onyx")]
#[case("rhyhorn")]
fn test_profile_url_fallback_prefers_label(#[case] template_name: &str) {
    const LABEL: &str = "okafor.design/links";
    const LABELED_HREF: &str = "https://okafor.design/links";
    const BARE_HREF: &str = "https://rustume.dev/anon";

    let renderer = TypstRenderer::new();
    let mut resume = sample_resume();
    resume.metadata.template = template_name.to_string();
    resume.sections.profiles = Section::new("profiles", "Profiles");
    resume.sections.profiles.visible = true;

    resume.sections.profiles.add_item(Profile {
        url: Url::with_label(LABEL, LABELED_HREF),
        ..Profile::default()
    });
    resume.sections.profiles.add_item(Profile {
        url: Url::new(BARE_HREF),
        ..Profile::default()
    });

    let pdf = renderer
        .render_pdf(&resume)
        .unwrap_or_else(|e| panic!("PDF render failed for '{template_name}': {e:?}"));

    let text = extract_pdf_pages_text(&pdf).join("\n");
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    assert!(
        compact.contains(LABEL) && !compact.contains(LABELED_HREF),
        "'{template_name}' should use the profile URL label as fallback text, got:\n{text}"
    );
    assert!(
        compact.contains(BARE_HREF),
        "'{template_name}' should print the href when the label is empty, got:\n{text}"
    );
}
