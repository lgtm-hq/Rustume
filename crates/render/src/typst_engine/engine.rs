//! Typst rendering engine.

use crate::traits::{RenderError, Renderer};
use crate::typst_engine::world::RustumeWorld;
use rustume_schema::{PageFormat, ResumeData};
use tracing::{debug, instrument, warn};

/// Available templates.
pub const TEMPLATES: &[&str] = &[
    "rhyhorn",   // Single-column linear, olive green accent (#65a30d)
    "azurill",   // Sidebar left + main right, amber accent (#d97706)
    "pikachu",   // Sidebar left + main right, gold accent (#ca8a04)
    "nosepass",  // Single-column linear, blue accent (#3b82f6)
    "bronzor",   // Single-column centered header, teal accent (#0891b2)
    "chikorita", // Main left + sidebar right, green accent (#16a34a)
    "ditto",     // Sidebar left + main right, teal accent (#0891b2)
    "gengar",    // Header-in-sidebar left + main right, light teal accent (#67b8c8)
    "glalie",    // Header-in-sidebar left + main right, teal accent (#14b8a6)
    "kakuna",    // Single-column linear, tan/brown accent (#78716c)
    "leafish",   // Full-width header + equal two columns, rose accent (#9f1239)
    "onyx",      // Single-column linear, red accent (#dc2626)
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
    #[instrument(skip(self, resume), fields(template = %resume.metadata.template))]
    pub fn generate_source(&self, resume: &ResumeData) -> Result<String, RenderError> {
        debug!("Generating Typst source");
        let template = &resume.metadata.template;
        let template_name = if TEMPLATES.contains(&template.as_str()) {
            template.as_str()
        } else {
            warn!(
                requested = %template,
                fallback = %self.default_template,
                "Unknown template, using fallback"
            );
            &self.default_template
        };

        // Serialize resume data to JSON for Typst
        let resume_json = serde_json::to_string(resume)
            .map_err(|e| RenderError::RenderFailed(format!("JSON serialization failed: {}", e)))?;

        // Escape the JSON for embedding in Typst string
        // We need to escape backslashes first, then quotes
        let escaped_json = resume_json.replace('\\', "\\\\").replace('"', "\\\"");

        // Escape font family for embedding in Typst string (same escaping as JSON)
        let escaped_font_family = resume
            .metadata
            .typography
            .font
            .family
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
            font_family = escaped_font_family,
            font_size = resume.metadata.typography.font.size,
            resume_json = escaped_json,
        );

        Ok(source)
    }

    /// Compile the Typst source to a document.
    #[instrument(skip(self, resume))]
    fn compile(&self, resume: &ResumeData) -> Result<typst::layout::PagedDocument, RenderError> {
        use typst::World;

        debug!("Starting Typst compilation");
        let source = self.generate_source(resume)?;
        let world = RustumeWorld::new(source);

        debug!("Compiling Typst document");
        let result = typst::compile(&world);
        result.output.map_err(|errors| {
            let messages: Vec<String> = errors
                .iter()
                .map(|e| {
                    // Try to get source context for the error
                    let file_id = e.span.id().unwrap_or_else(|| world.main());
                    let location = if let Ok(src) = world.source(file_id) {
                        if let Some(range) = src.range(e.span) {
                            // Find line number by counting newlines before the error position
                            let line = src.text()[..range.start].matches('\n').count();
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
    #[instrument(skip(self, resume))]
    fn render_pdf(&self, resume: &ResumeData) -> Result<Vec<u8>, RenderError> {
        debug!("Rendering PDF");
        let document = self.compile(resume)?;

        debug!("Converting to PDF format");
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

    #[instrument(skip(self, resume), fields(page))]
    fn render_preview(&self, resume: &ResumeData, page: usize) -> Result<Vec<u8>, RenderError> {
        debug!("Rendering preview for page {}", page);
        let document = self.compile(resume)?;

        // Get the requested page
        let page_content = document
            .pages
            .get(page)
            .ok_or_else(|| RenderError::RenderFailed(format!("Page {} not found", page)))?;

        debug!("Rendering page to PNG");
        // Render to PNG at 2x scale for high quality
        let pixmap = typst_render::render(page_content, 2.0);

        debug!("Encoding PNG");
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
        PageFormat::A4 => (595.28, 841.89),   // 210mm x 297mm
        PageFormat::Letter => (612.0, 792.0), // 8.5in x 11in
    }
}

/// Get the default theme colors for a template.
/// Colors sourced from turbo-resume/libs/utils/src/namespaces/template.ts
pub fn get_template_theme(template: &str) -> TemplateTheme {
    match template {
        "rhyhorn" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#65a30d".into(),
        },
        "azurill" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#d97706".into(),
        },
        "pikachu" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1c1917".into(),
            primary: "#ca8a04".into(),
        },
        "nosepass" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#3b82f6".into(),
        },
        "bronzor" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#0891b2".into(),
        },
        "chikorita" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#166534".into(),
            primary: "#16a34a".into(),
        },
        "ditto" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#0891b2".into(),
        },
        "gengar" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#67b8c8".into(),
        },
        "glalie" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#0f172a".into(),
            primary: "#14b8a6".into(),
        },
        "kakuna" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#422006".into(),
            primary: "#78716c".into(),
        },
        "leafish" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#1f2937".into(),
            primary: "#9f1239".into(),
        },
        "onyx" => TemplateTheme {
            background: "#ffffff".into(),
            text: "#111827".into(),
            primary: "#dc2626".into(),
        },
        // Default to rhyhorn theme for unknown templates
        _ => TemplateTheme {
            background: "#ffffff".into(),
            text: "#000000".into(),
            primary: "#65a30d".into(),
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

        resume.sections.summary.content =
            "Experienced software engineer with a passion for building great products.".to_string();

        resume.sections.experience = Section::new("experience", "Experience");
        resume.sections.experience.add_item(
            Experience::new("Acme Corp", "Senior Developer")
                .with_date("2020 - Present")
                .with_summary("Led development of core platform features."),
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
        assert_eq!(rhyhorn.primary, "#65a30d");

        let pikachu = get_template_theme("pikachu");
        assert_eq!(pikachu.primary, "#ca8a04");
    }

    // Note: PDF rendering tests require fonts to be available
    // These are better as integration tests
}
