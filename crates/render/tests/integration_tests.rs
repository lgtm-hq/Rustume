//! Integration tests for the render crate.
//!
//! These tests verify that the Typst renderer can compile and render
//! resumes to PDF and PNG output.

use rustume_parser::{JsonResumeParser, Parser, ReactiveResumeV3Parser};
use rustume_render::{get_page_size, get_template_theme, Renderer, TypstRenderer, TEMPLATES};
use rustume_schema::{Basics, Education, Experience, PageFormat, ResumeData, Section, Skill};
use std::fs;
use std::path::PathBuf;

/// Get the path to test fixtures directory.
fn fixtures_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
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

#[test]
fn test_template_theme() {
    let rhyhorn = get_template_theme("rhyhorn");
    assert_eq!(rhyhorn.primary, "#dc2626");
    assert_eq!(rhyhorn.background, "#ffffff");
    assert_eq!(rhyhorn.text, "#000000");

    let pikachu = get_template_theme("pikachu");
    assert_eq!(pikachu.primary, "#ca8a04");

    // Unknown template returns default
    let unknown = get_template_theme("unknown");
    assert_eq!(unknown.primary, "#dc2626");
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
    // A resume with content should produce a reasonable sized PDF
    assert!(pdf.len() > 1000, "PDF seems too small for content");
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
