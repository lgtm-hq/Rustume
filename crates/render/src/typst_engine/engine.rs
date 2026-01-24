//! Typst rendering engine.

use crate::traits::{RenderError, Renderer};
use crate::typst_engine::world::RustumeWorld;
use rustume_schema::{PageFormat, ResumeData};

/// Available templates.
pub const TEMPLATES: &[&str] = &[
    "rhyhorn",   // Clean, two-column with red accent
    "azurill",   // Minimal, single column with amber accent
    "pikachu",   // Modern, sidebar layout with yellow accent
    "nosepass",  // Professional, classic with blue accent
];

/// Typst-based PDF renderer.
pub struct TypstRenderer {
    /// Default template to use.
    default_template: String,
}

impl TypstRenderer {
    /// Create a new Typst renderer.
    pub fn new() -> Self {
        Self {
            default_template: "rhyhorn".to_string(),
        }
    }

    /// Create a renderer with a specific default template.
    pub fn with_template(template: impl Into<String>) -> Self {
        Self {
            default_template: template.into(),
        }
    }

    /// Generate the Typst source code for a resume.
    pub fn generate_source(&self, resume: &ResumeData) -> Result<String, RenderError> {
        let template = &resume.metadata.template;
        let template_name = if TEMPLATES.contains(&template.as_str()) {
            template.as_str()
        } else {
            &self.default_template
        };

        // Serialize resume data to JSON for Typst
        let resume_json = serde_json::to_string(resume)
            .map_err(|e| RenderError::RenderFailed(format!("JSON serialization failed: {}", e)))?;

        // Escape the JSON for embedding in Typst string
        // We need to escape backslashes first, then quotes
        let escaped_json = resume_json
            .replace('\\', "\\\\")
            .replace('"', "\\\"");

        // Generate the main Typst source that imports the template and passes data
        let source = format!(
            r#"#import "templates/{template}.typ": template

// Page configuration
#set page(
  paper: "{paper}",
  margin: {margin}pt,
)

// Typography configuration
#set text(
  font: "{font_family}",
  size: {font_size}pt,
)

// Parse the resume data
#let data = json.decode("{resume_json}")

// Render the template
#template(data)
"#,
            template = template_name,
            paper = match resume.metadata.page.format {
                PageFormat::A4 => "a4",
                PageFormat::Letter => "us-letter",
            },
            margin = resume.metadata.page.margin,
            font_family = resume.metadata.typography.font.family,
            font_size = resume.metadata.typography.font.size,
            resume_json = escaped_json,
        );

        Ok(source)
    }

    /// Compile the Typst source to a document.
    fn compile(&self, resume: &ResumeData) -> Result<typst::model::Document, RenderError> {
        use typst::World;

        let source = self.generate_source(resume)?;
        let world = RustumeWorld::new(source);

        let result = typst::compile(&world);
        result.output.map_err(|errors| {
            let messages: Vec<String> = errors
                .iter()
                .map(|e| {
                    // Try to get source context for the error
                    let file_id = e.span.id().unwrap_or_else(|| world.main());
                    let location = if let Ok(src) = world.source(file_id) {
                        if let Some(range) = src.range(e.span) {
                            let line = src.byte_to_line(range.start).unwrap_or(0);
                            let text = src.text().lines().nth(line).unwrap_or("");
                            format!("{:?}:{}: {}", src.id().vpath(), line + 1, text.trim())
                        } else {
                            format!("{:?}", src.id().vpath())
                        }
                    } else {
                        format!("{:?}", e.span)
                    };
                    format!("{}: {}", location, e.message)
                })
                .collect();
            RenderError::RenderFailed(format!(
                "Typst compilation failed:\n{}",
                messages.join("\n")
            ))
        })
    }
}

impl Default for TypstRenderer {
    fn default() -> Self {
        Self::new()
    }
}

impl Renderer for TypstRenderer {
    fn render_pdf(&self, resume: &ResumeData) -> Result<Vec<u8>, RenderError> {
        let document = self.compile(resume)?;

        // Convert to PDF with default options
        let options = typst_pdf::PdfOptions::default();
        let pdf_result = typst_pdf::pdf(&document, &options);

        pdf_result.map_err(|errors| {
            let messages: Vec<String> = errors
                .iter()
                .map(|e| format!("{:?}: {}", e.span, e.message))
                .collect();
            RenderError::RenderFailed(format!("PDF generation failed:\n{}", messages.join("\n")))
        })
    }

    fn render_html(&self, _resume: &ResumeData) -> Result<String, RenderError> {
        // HTML rendering is not implemented via Typst
        // This would be handled separately for web preview
        Err(RenderError::RenderFailed(
            "HTML rendering not supported via Typst. Use web-based preview.".to_string(),
        ))
    }

    fn render_preview(&self, resume: &ResumeData, page: usize) -> Result<Vec<u8>, RenderError> {
        let document = self.compile(resume)?;

        // Get the requested page
        let page_content = document
            .pages
            .get(page)
            .ok_or_else(|| RenderError::RenderFailed(format!("Page {} not found", page)))?;

        // Render to PNG at 2x scale for high quality
        let pixmap = typst_render::render(page_content, 2.0);

        // Encode as PNG
        let png_bytes = pixmap
            .encode_png()
            .map_err(|e| RenderError::RenderFailed(format!("PNG encoding failed: {}", e)))?;

        Ok(png_bytes)
    }
}

/// Get page dimensions in points for a page format.
pub fn get_page_size(format: PageFormat) -> (f64, f64) {
    match format {
        PageFormat::A4 => (595.28, 841.89),     // 210mm x 297mm
        PageFormat::Letter => (612.0, 792.0),   // 8.5in x 11in
    }
}

/// Get the default theme colors for a template.
pub fn get_template_theme(template: &str) -> TemplateTheme {
    match template {
        "rhyhorn" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#dc2626".into(),
        },
        "azurill" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#d97706".into(),
        },
        "pikachu" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#ca8a04".into(),
        },
        "nosepass" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#3b82f6".into(),
        },
        // Default to rhyhorn theme for unknown templates
        _ => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#dc2626".into(),
        },
    }
}

/// Template theme colors.
#[derive(Debug, Clone)]
pub struct TemplateTheme {
    pub background: String,
    pub text: String,
    pub primary: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustume_schema::{Basics, Experience, Section};

    #[allow(clippy::field_reassign_with_default)]
    fn sample_resume() -> ResumeData {
        let mut resume = ResumeData::default();
        resume.basics = Basics::new("John Doe")
            .with_headline("Software Engineer")
            .with_email("john@example.com")
            .with_phone("+1-555-123-4567")
            .with_location("San Francisco, CA");

        resume.sections.summary.content = "Experienced software engineer with a passion for building great products.".to_string();

        resume.sections.experience = Section::new("experience", "Experience");
        resume.sections.experience.add_item(
            Experience::new("Acme Corp", "Senior Developer")
                .with_date("2020 - Present")
                .with_summary("Led development of core platform features.")
        );

        resume
    }

    #[test]
    fn test_generate_source() {
        let renderer = TypstRenderer::new();
        let resume = sample_resume();

        let source = renderer.generate_source(&resume).unwrap();

        assert!(source.contains("rhyhorn"));
        assert!(source.contains("John Doe"));
        assert!(source.contains("Software Engineer"));
    }

    #[test]
    fn test_template_theme() {
        let rhyhorn = get_template_theme("rhyhorn");
        assert_eq!(rhyhorn.primary, "#dc2626");

        let pikachu = get_template_theme("pikachu");
        assert_eq!(pikachu.primary, "#ca8a04");
    }

    // Note: PDF rendering tests require fonts to be available
    // These are better as integration tests
}
