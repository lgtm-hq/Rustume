//! Integration tests for the render crate.
//!
//! These tests verify that the Typst renderer can compile and render
//! resumes to PDF and PNG output.

use rstest::rstest;
use rustume_parser::{JsonResumeParser, Parser, ReactiveResumeV3Parser};
use rustume_render::{get_page_size, get_template_theme, Renderer, TypstRenderer, TEMPLATES};
use rustume_schema::{Basics, Education, Experience, PageFormat, ResumeData, Section, Skill};
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

    let png = result.unwrap();
    // PNG files start with the PNG signature
    assert!(
        png.starts_with(&[0x89, 0x50, 0x4E, 0x47]),
        "Output is not a valid PNG"
    );
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
