//! Typst rendering engine.

use crate::traits::{RenderError, Renderer};
use crate::typst_engine::world::RustumeWorld;
use rustume_schema::{ContentFormat, PageFormat, ResumeData};
use rustume_utils::{escape_typst_string_literal, markdown_to_typst, sanitize_html_to_typst};
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

/// Generated Typst source plus an optional decoded picture asset
/// (virtual path, bytes) to expose to the Typst world.
type PreparedSource = (String, Option<(String, Vec<u8>)>);

/// Decode a `data:image/<subtype>;base64,` picture URL into bytes and rewrite
/// the picture URL to a virtual asset path so Typst's `image()` can load it.
/// Leaves the resume untouched when the URL is not a supported data URL.
fn extract_picture_asset(resume: &mut ResumeData) -> Option<(String, Vec<u8>)> {
    use base64::Engine as _;

    let rest = resume.basics.picture.url.strip_prefix("data:image/")?;
    let (subtype, encoded) = rest.split_once(";base64,")?;
    let ext = match subtype {
        "jpeg" => "jpg",
        "png" => "png",
        "webp" => "webp",
        "gif" => "gif",
        _ => return None,
    };
    let data = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .ok()?;

    // Absolute virtual path so it resolves from the project root regardless of
    // which template file calls `image()`.
    let path = format!("/assets/picture.{ext}");
    resume.basics.picture.url = path.clone();
    Some((path, data))
}

/// True when Typst can load this picture from the virtual world (rewritten
/// `/assets/picture.*` path) without fetching a remote URL.
fn is_embeddable_picture_url(url: &str) -> bool {
    url.trim().starts_with("/assets/picture.")
}

/// Classify a picture URL for logs. Never echo the URL — signed query
/// tokens, userinfo, and data-URL payloads must not land in log storage.
fn picture_url_kind(url: &str) -> &'static str {
    let url = url.trim();
    if url.starts_with("https://") {
        "https"
    } else if url.starts_with("http://") {
        "http"
    } else if url.starts_with("data:") {
        "data"
    } else {
        "other"
    }
}

/// Clear a non-embeddable picture URL so Typst never looks it up on the
/// virtual filesystem. Remote `http(s):` URLs are not fetched (SSRF). Other
/// picture fields are left intact so the template can still honor size,
/// effects, and the initials fallback.
fn skip_non_embeddable_picture_url(resume: &mut ResumeData) {
    let url = resume.basics.picture.url.trim();
    if url.is_empty() || is_embeddable_picture_url(url) {
        return;
    }

    warn!(
        url_kind = picture_url_kind(&resume.basics.picture.url),
        "Skipping non-embeddable profile picture URL; rendering without a photo"
    );
    resume.basics.picture.url.clear();
}

/// Convert one rich-text field to Typst markup, in the format the resume
/// declares.
///
/// Rich text reaches the renderer in two formats: the form builder stores
/// TipTap HTML, the document editor stores markdown. The format is taken from
/// the resume's `contentFormat` marker and never inferred from the content —
/// the two are not distinguishable by inspection, since plain prose like
/// `1988. A good year` is a valid markdown ordered list. An absent marker means
/// HTML. That path sanitizes and converts, and honours a markdown subset so
/// `**bold**` / `- ` lists in existing JSON render instead of printing stars.
fn convert_field(content: &str, format: ContentFormat) -> String {
    if content.is_empty() {
        return String::new();
    }
    match format {
        ContentFormat::Html => sanitize_html_to_typst(content),
        ContentFormat::Markdown => markdown_to_typst(content),
    }
}

/// Clone resume data and preprocess all rich-text fields (summary, description)
/// from HTML or markdown to Typst markup so templates can `eval()` them.
fn preprocess_rich_text(resume: &ResumeData) -> ResumeData {
    let mut r = resume.clone();
    let format = r.metadata.content_format();
    let convert = |content: &str| convert_field(content, format);

    // Summary section content
    r.sections.summary.content = convert(&r.sections.summary.content);

    // Cover letter body
    r.sections.cover_letter.content = convert(&r.sections.cover_letter.content);

    // Experience: summary
    for item in &mut r.sections.experience.items {
        item.summary = convert(&item.summary);
    }

    // Education: summary
    for item in &mut r.sections.education.items {
        item.summary = convert(&item.summary);
    }

    // Skills: description
    for item in &mut r.sections.skills.items {
        item.description = convert(&item.description);
    }

    // Projects: summary, description
    for item in &mut r.sections.projects.items {
        item.summary = convert(&item.summary);
        item.description = convert(&item.description);
    }

    // Awards: summary
    for item in &mut r.sections.awards.items {
        item.summary = convert(&item.summary);
    }

    // Certifications: summary
    for item in &mut r.sections.certifications.items {
        item.summary = convert(&item.summary);
    }

    // Publications: summary
    for item in &mut r.sections.publications.items {
        item.summary = convert(&item.summary);
    }

    // Languages: description
    for item in &mut r.sections.languages.items {
        item.description = convert(&item.description);
    }

    // Volunteer: summary
    for item in &mut r.sections.volunteer.items {
        item.summary = convert(&item.summary);
    }

    // References: summary, description
    for item in &mut r.sections.references.items {
        item.summary = convert(&item.summary);
        item.description = convert(&item.description);
    }

    // Custom sections: summary, description
    for section in r.sections.custom.values_mut() {
        for item in &mut section.items {
            item.summary = convert(&item.summary);
            item.description = convert(&item.description);
        }
    }

    r
}

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
        Ok(self.prepare_source(resume)?.0)
    }

    /// Generate the Typst source plus any binary picture asset extracted from
    /// an inline data URL (the only URL form the web app produces on upload).
    fn prepare_source(&self, resume: &ResumeData) -> Result<PreparedSource, RenderError> {
        debug!("Generating Typst source");

        // Validate metadata bounds before embedding in Typst source
        let margin = resume.metadata.page.margin;
        if margin > 100 {
            return Err(RenderError::InvalidConfig(format!(
                "Margin {}pt exceeds maximum of 100pt",
                margin
            )));
        }
        let font_size = resume.metadata.typography.font.size;
        if !(6..=72).contains(&font_size) {
            return Err(RenderError::InvalidConfig(format!(
                "Font size {}pt is outside the allowed range of 6–72pt",
                font_size
            )));
        }

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

        // Preprocess HTML fields → Typst markup before serialization
        let mut resume = preprocess_rich_text(resume);

        // Embed a data-URL picture, or drop a remote/non-embeddable URL (#738).
        let picture_asset = extract_picture_asset(&mut resume);
        skip_non_embeddable_picture_url(&mut resume);

        // Serialize resume data to JSON for Typst
        let resume_json = serde_json::to_string(&resume)
            .map_err(|e| RenderError::RenderFailed(format!("JSON serialization failed: {}", e)))?;

        // Single-pass escape of \\ and \" (one scan, one allocation;
        // photo data URLs make this string 100 KB-2 MB).
        let escaped_json = escape_typst_string_literal(&resume_json);

        // Escape font family for embedding in Typst string (same escaping as JSON)
        let escaped_font_family =
            escape_typst_string_literal(&resume.metadata.typography.font.family);

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
#let data = json(bytes("{resume_json}"))

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

        Ok((source, picture_asset))
    }

    /// Compile the Typst source to a document.
    #[instrument(skip(self, resume))]
    fn compile(&self, resume: &ResumeData) -> Result<typst_layout::PagedDocument, RenderError> {
        use typst::{World, WorldExt};

        debug!("Starting Typst compilation");
        let (source, picture_asset) = self.prepare_source(resume)?;
        let mut world = RustumeWorld::new(source)?;
        world.register_profile_icons()?;
        if let Some((path, data)) = picture_asset {
            world.add_binary_file(&path, data)?;
        }

        debug!("Compiling Typst document");
        let result = typst::compile::<typst_layout::PagedDocument>(&world);
        result.output.map_err(|errors| {
            let messages: Vec<String> = errors
                .iter()
                .map(|e| {
                    // Try to get source context for the error
                    let file_id = e.span.id().unwrap_or_else(|| world.main());
                    let location = if let Ok(src) = world.source(file_id) {
                        if let Some(range) = world.range(e.span) {
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

    /// Render a preview page at a custom scale (`pixel_per_pt`).
    ///
    /// Visual baseline tests use a moderate DPI (1.0) to keep committed PNGs
    /// small; [`Renderer::render_preview`] keeps the 2.0 production default.
    #[instrument(skip(self, resume), fields(page, pixel_per_pt))]
    pub fn render_preview_at(
        &self,
        resume: &ResumeData,
        page: usize,
        pixel_per_pt: f64,
    ) -> Result<(Vec<u8>, usize), RenderError> {
        debug!(
            "Rendering preview for page {} at {} px/pt",
            page, pixel_per_pt
        );
        let document = self.compile(resume)?;
        let total_pages = document.pages().len();

        let page_content = document
            .pages()
            .get(page)
            .ok_or_else(|| RenderError::RenderFailed(format!("Page {} not found", page)))?;

        debug!("Rendering page to PNG");
        let opts = typst_render::RenderOptions {
            pixel_per_pt: typst::utils::Scalar::new(pixel_per_pt),
            render_bleed: false,
        };
        let pixmap = typst_render::render(page_content, &opts);

        debug!("Encoding PNG");
        let png_bytes = pixmap
            .encode_png()
            .map_err(|e| RenderError::RenderFailed(format!("PNG encoding failed: {}", e)))?;

        Ok((png_bytes, total_pages))
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
    fn render_preview(
        &self,
        resume: &ResumeData,
        page: usize,
    ) -> Result<(Vec<u8>, usize), RenderError> {
        // Production previews use 2× scale for crisp UI thumbnails
        // (RenderOptions::default is also 2.0 px/pt).
        self.render_preview_at(resume, page, 2.0)
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
    use rustume_schema::{Basics, Experience, Picture, Section};

    const PNG_DATA_URL: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const REMOTE_PICTURE_URL: &str = "https://example.com/photo.jpg";

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
    fn test_extract_picture_asset_embeds_png_data_url() {
        let mut resume = ResumeData::default();
        resume.basics.picture = Picture::new(PNG_DATA_URL);

        let (path, data) = extract_picture_asset(&mut resume).expect("data URL should embed");
        assert_eq!(path, "/assets/picture.png");
        assert!(!data.is_empty());
        assert_eq!(resume.basics.picture.url, "/assets/picture.png");

        skip_non_embeddable_picture_url(&mut resume);
        assert_eq!(resume.basics.picture.url, "/assets/picture.png");
    }

    #[test]
    fn test_skip_remote_picture_url_clears_url_keeps_other_fields() {
        let mut resume = ResumeData::default();
        resume.basics.picture = Picture::new(REMOTE_PICTURE_URL);
        resume.basics.picture.size = 96;
        resume.basics.picture.border_radius = 8;
        resume.basics.picture.effects.border = true;

        assert!(extract_picture_asset(&mut resume).is_none());
        skip_non_embeddable_picture_url(&mut resume);

        assert!(
            resume.basics.picture.url.is_empty(),
            "remote picture URL must be cleared, got {}",
            resume.basics.picture.url
        );
        assert_eq!(resume.basics.picture.size, 96);
        assert_eq!(resume.basics.picture.border_radius, 8);
        assert!(resume.basics.picture.effects.border);
    }

    #[test]
    fn test_picture_url_kind_does_not_echo_credentials() {
        let token_url = "https://cdn.example.com/photo.jpg?token=super-secret";
        assert_eq!(picture_url_kind(token_url), "https");
        assert!(!picture_url_kind(token_url).contains("secret"));
        assert!(!picture_url_kind(token_url).contains("token"));
        // Assemble userinfo at runtime so the source file never contains a
        // `scheme://user:pass@host` literal (Trufflehog URI detector).
        let mut userinfo_url = String::from("https");
        userinfo_url.push_str("://");
        userinfo_url.push_str("user");
        userinfo_url.push(':');
        userinfo_url.push_str("hunter2");
        userinfo_url.push('@');
        userinfo_url.push_str("cdn.example.com/photo.jpg");
        assert_eq!(picture_url_kind(&userinfo_url), "https");
        assert!(!picture_url_kind(&userinfo_url).contains("hunter2"));
        assert_eq!(picture_url_kind("http://insecure.example/pic.png"), "http");
        assert_eq!(picture_url_kind("data:image/png;base64,AAAA"), "data");
        assert_eq!(picture_url_kind("ftp://files.example/pic"), "other");
    }

    #[test]
    fn test_skip_empty_picture_url_is_a_no_op() {
        let mut resume = ResumeData::default();
        resume.basics.picture = Picture::default();
        resume.basics.picture.size = 48;

        assert!(extract_picture_asset(&mut resume).is_none());
        skip_non_embeddable_picture_url(&mut resume);

        assert!(resume.basics.picture.url.is_empty());
        assert_eq!(resume.basics.picture.size, 48);
    }

    #[test]
    fn test_generate_source_skips_remote_picture_url() {
        let renderer = TypstRenderer::new();
        let mut resume = sample_resume();
        resume.basics.picture = Picture::new(REMOTE_PICTURE_URL);

        let (source, asset) = renderer.prepare_source(&resume).unwrap();
        assert!(
            asset.is_none(),
            "remote URLs must not be fetched or embedded"
        );
        assert!(
            !source.contains(REMOTE_PICTURE_URL),
            "remote picture URL must not be passed to Typst: {source}"
        );
        assert!(
            !source.contains("photo.jpg"),
            "remote picture path must not reach Typst source: {source}"
        );
    }

    #[test]
    fn test_generate_source_embeds_data_url_picture() {
        let renderer = TypstRenderer::new();
        let mut resume = sample_resume();
        resume.basics.picture = Picture::new(PNG_DATA_URL);

        let (source, asset) = renderer.prepare_source(&resume).unwrap();
        let (path, bytes) = asset.expect("PNG data URL should become a virtual asset");
        assert_eq!(path, "/assets/picture.png");
        assert!(!bytes.is_empty());
        assert!(
            source.contains("/assets/picture.png"),
            "embedded picture path missing from Typst source: {source}"
        );
        assert!(
            !source.contains("data:image/png"),
            "raw data URL must be rewritten before Typst: {source}"
        );
    }

    #[test]
    fn test_generate_source_empty_picture_url() {
        let renderer = TypstRenderer::new();
        let mut resume = sample_resume();
        resume.basics.picture = Picture::default();
        assert!(resume.basics.picture.url.is_empty());

        let (source, asset) = renderer.prepare_source(&resume).unwrap();
        assert!(asset.is_none());
        assert!(source.contains("John Doe"));
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

    #[test]
    fn test_rejects_excessive_margin() {
        let mut resume = ResumeData::default();
        resume.metadata.page.margin = 150;
        let renderer = TypstRenderer::new();
        let result = renderer.generate_source(&resume);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Margin"), "Expected margin error, got: {err}");
    }

    #[test]
    fn test_rejects_extreme_font_size() {
        let mut resume = ResumeData::default();
        resume.metadata.typography.font.size = 2;
        let renderer = TypstRenderer::new();
        let result = renderer.generate_source(&resume);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Font size"),
            "Expected font size error, got: {err}"
        );
    }

    #[test]
    fn generate_source_embeds_metadata_font_size() {
        let mut resume = sample_resume();
        resume.metadata.typography.font.size = 18;
        let source = TypstRenderer::new().generate_source(&resume).unwrap();
        assert!(
            source.contains("size: 18pt"),
            "engine must #set text(size) from metadata.typography.font.size, got:\n{source}"
        );
    }

    #[test]
    fn templates_use_shared_typography_leading() {
        let dir =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/typst_engine/templates");
        let common = std::fs::read_to_string(dir.join("_common.typ")).unwrap();
        assert!(
            common.contains("#let typography-leading"),
            "_common.typ must export typography-leading"
        );
        assert!(
            common.contains("#let clamp-line-height"),
            "_common.typ must clamp lineHeight at the template boundary"
        );
        assert!(
            common.contains("(line-height - 1.0) * 1em"),
            "_common.typ must document leading = (clamped_line_height - 1.0) * 1em"
        );
        assert!(
            !common.contains("1.3em"),
            "magic 1.3 multiplier must not return"
        );

        for name in TEMPLATES {
            let src = std::fs::read_to_string(dir.join(format!("{name}.typ"))).unwrap();
            assert!(
                src.contains("typography-leading(data)"),
                "{name} must use typography-leading, not a hardcoded leading"
            );
            assert!(
                !src.contains("leading: 0.65em")
                    && !src.contains("leading: 0.7em")
                    && !src.contains("leading: 0.6em"),
                "{name} still hardcodes par.leading"
            );

            let page_set_text = src
                .split("set par(")
                .next()
                .and_then(|before| before.rsplit("set text(").next())
                .unwrap_or("");
            assert!(
                !page_set_text.contains("size:"),
                "{name} page-level set text still overrides body size:\n{page_set_text}"
            );
        }
    }

    #[test]
    fn test_preprocess_rich_text_converts_html() {
        let mut resume = ResumeData::default();
        resume.sections.summary.content = "<p>Built <strong>great</strong> things</p>".to_string();
        resume.sections.experience = Section::new("experience", "Experience");
        resume
            .sections
            .experience
            .add_item(Experience::new("Acme", "Dev").with_summary("<p>Led <em>core</em> work</p>"));

        let processed = preprocess_rich_text(&resume);

        assert!(
            processed.sections.summary.content.contains("bold"),
            "Expected Typst bold markup, got: {}",
            processed.sections.summary.content
        );
        assert!(
            processed.sections.experience.items[0]
                .summary
                .contains("emph"),
            "Expected Typst emph markup, got: {}",
            processed.sections.experience.items[0].summary
        );
    }

    #[test]
    fn test_preprocess_rich_text_converts_cover_letter() {
        let mut resume = ResumeData::default();
        resume.sections.cover_letter.content =
            "<p>Dear <strong>Jane</strong>, I am <em>excited</em> to apply.</p>".to_string();

        let processed = preprocess_rich_text(&resume);

        assert!(
            processed.sections.cover_letter.content.contains("bold"),
            "Expected Typst bold markup, got: {}",
            processed.sections.cover_letter.content
        );
        assert!(
            processed.sections.cover_letter.content.contains("emph"),
            "Expected Typst emph markup, got: {}",
            processed.sections.cover_letter.content
        );
        assert!(
            !processed.sections.cover_letter.content.contains("<p>"),
            "Expected raw HTML to be converted, got: {}",
            processed.sections.cover_letter.content
        );
    }

    #[test]
    fn test_preprocess_plain_text_passthrough() {
        let mut resume = ResumeData::default();
        resume.sections.summary.content = "Plain text summary".to_string();

        let processed = preprocess_rich_text(&resume);

        assert_eq!(processed.sections.summary.content, "Plain text summary");
    }

    #[test]
    fn test_preprocess_rich_text_converts_markdown() {
        let mut resume = ResumeData::default();
        resume.metadata.content_format = Some(ContentFormat::Markdown);
        resume.sections.summary.content = "Built **great** things\n\n- Shipped *fast*".to_string();
        resume.sections.experience = Section::new("experience", "Experience");
        resume.sections.experience.add_item(
            Experience::new("Acme", "Dev").with_summary("Led [core](https://acme.test) work"),
        );

        let processed = preprocess_rich_text(&resume);

        assert_eq!(
            processed.sections.summary.content,
            "Built #text(weight: \"bold\")[great] things\n\n- Shipped #emph[fast]"
        );
        assert_eq!(
            processed.sections.experience.items[0].summary,
            "Led #link(\"https://acme.test\")[core] work"
        );
    }

    #[test]
    fn test_preprocess_rich_text_markdown_marker_does_not_change_html_resumes() {
        // A lone asterisk inside HTML is literal text, not emphasis. The
        // default (absent) marker keeps the field on the HTML path, which
        // honours a markdown subset but does not sniff contentFormat.
        let mut resume = ResumeData::default();
        resume.sections.summary.content = "<p>Rated 4*5 stars</p>".to_string();

        let processed = preprocess_rich_text(&resume);

        assert_eq!(processed.sections.summary.content, "Rated 4\\*5 stars");
    }

    #[test]
    fn test_preprocess_without_marker_does_not_infer_ordered_lists() {
        // Absent marker still means HTML — format is never sniffed from
        // content. The HTML converter understands a markdown subset so
        // `**bold**` and `- ` lists render, but `1988. A good year` must
        // stay prose (the reason contentFormat is never inferred).
        let cases = [
            ("1988. A good year", "1988. A good year"),
            (
                "Maintainer of __init__ and 4*5*6",
                "Maintainer of #text(weight: \"bold\")[init] and 4\\*5\\*6",
            ),
            // Dash-space is the HTML-path bullet subset; Typst form matches.
            ("- not a list", "- not a list"),
            ("#1 pick", "\\#1 pick"),
            (
                "**PwC Tax Technology**",
                "#text(weight: \"bold\")[PwC Tax Technology]",
            ),
        ];

        for (content, expected) in cases {
            let mut resume = ResumeData::default();
            resume.sections.summary.content = content.to_string();
            assert_eq!(
                resume.metadata.content_format, None,
                "marker must be absent"
            );

            let processed = preprocess_rich_text(&resume);

            assert_eq!(
                processed.sections.summary.content, expected,
                "unmarked HTML-path content: {content}"
            );
        }
    }

    #[test]
    fn test_generate_source_with_html() {
        let renderer = TypstRenderer::new();
        let mut resume = sample_resume();
        resume.sections.summary.content = "<p>Built <strong>great</strong> things</p>".to_string();

        let source = renderer.generate_source(&resume).unwrap();

        // The JSON in the source should contain the Typst markup, not raw HTML
        assert!(
            !source.contains("<strong>"),
            "Source should not contain raw HTML: {source}"
        );
    }

    const UNKNOWN_TEMPLATE_ID: &str = "not-a-template";

    const UPDATE_THEMES_FIXTURE_HINT: &str = concat!(
        "UPDATE_FIXTURES=1 cargo test -p rustume-render ",
        "template_themes_fixture_is_up_to_date --lib"
    );

    #[derive(serde::Serialize)]
    struct ThemeWire<'a> {
        background: &'a str,
        text: &'a str,
        primary: &'a str,
    }

    fn theme_wire(theme: &TemplateTheme) -> ThemeWire<'_> {
        ThemeWire {
            background: &theme.background,
            text: &theme.text,
            primary: &theme.primary,
        }
    }

    fn themes_fixture_path() -> std::path::PathBuf {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("crates parent")
            .parent()
            .expect("workspace root")
            .join("tests/fixtures/template-themes.json")
    }

    fn expected_themes_fixture_json() -> String {
        let mut map = serde_json::Map::new();
        for id in TEMPLATES {
            map.insert(
                (*id).to_string(),
                serde_json::to_value(theme_wire(&get_template_theme(id)))
                    .expect("ThemeWire serializes"),
            );
        }
        map.insert(
            UNKNOWN_TEMPLATE_ID.to_string(),
            serde_json::to_value(theme_wire(&get_template_theme(UNKNOWN_TEMPLATE_ID)))
                .expect("fallback ThemeWire serializes"),
        );
        let mut json = serde_json::to_string_pretty(&serde_json::Value::Object(map))
            .expect("themes fixture JSON pretty-prints");
        json.push('\n');
        json
    }

    #[test]
    fn template_themes_fixture_is_up_to_date() {
        let actual = expected_themes_fixture_json();
        let path = themes_fixture_path();
        if std::env::var_os("UPDATE_FIXTURES").is_some() {
            std::fs::create_dir_all(path.parent().expect("fixture has a parent"))
                .expect("create tests/fixtures");
            std::fs::write(&path, &actual)
                .unwrap_or_else(|err| panic!("write {}: {err}", path.display()));
            return;
        }
        let expected = std::fs::read_to_string(&path).unwrap_or_else(|err| {
            panic!(
                "missing fixture {}: {err}; regenerate with {UPDATE_THEMES_FIXTURE_HINT}",
                path.display()
            )
        });
        assert_eq!(
            actual,
            expected,
            "fixture out of date at {}\nregenerate with: {UPDATE_THEMES_FIXTURE_HINT}",
            path.display()
        );
    }

    #[test]
    fn unknown_template_theme_matches_rhyhorn() {
        assert_eq!(
            get_template_theme(UNKNOWN_TEMPLATE_ID).primary,
            get_template_theme("rhyhorn").primary
        );
        assert_eq!(
            get_template_theme(UNKNOWN_TEMPLATE_ID).text,
            get_template_theme("rhyhorn").text
        );
        assert_eq!(
            get_template_theme(UNKNOWN_TEMPLATE_ID).background,
            get_template_theme("rhyhorn").background
        );
    }
}
