use utoipa::OpenApi;

use crate::dto::{
    ParseFormat, ParseRequest, RenderPdfRequest, RenderPreviewRequest, TemplateInfo, ThemeInfo,
    ValidationResponse,
};
use crate::error::ApiError;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Rustume API",
        version = env!("CARGO_PKG_VERSION"),
        description = "REST API for resume parsing, rendering, and validation.\n\n## Features\n\n- **Parse**: Import resumes from JSON Resume, LinkedIn exports, or Reactive Resume v3\n- **Render**: Generate PDF or PNG previews of resumes\n- **Validate**: Check resume data against the schema\n- **Templates**: List available resume templates with theme colors",
        license(name = "MIT", url = "https://opensource.org/licenses/MIT"),
        contact(name = "Rustume", url = "https://github.com/lgtm-hq/Rustume")
    ),
    servers(
        (url = "/", description = "Local server")
    ),
    paths(
        crate::routes::health::health,
        crate::routes::templates::list_templates,
        crate::routes::templates::template_thumbnail,
        crate::routes::parse::parse,
        crate::routes::render::render_pdf,
        crate::routes::render::render_preview,
        crate::routes::validate::validate
    ),
    components(
        schemas(
            ApiError,
            ParseFormat,
            ParseRequest,
            RenderPdfRequest,
            RenderPreviewRequest,
            TemplateInfo,
            ThemeInfo,
            ValidationResponse,
            rustume_schema::ResumeData
        )
    ),
    tags(
        (name = "Health", description = "Health check endpoints"),
        (name = "Templates", description = "Template management"),
        (name = "Parse", description = "Resume parsing from various formats"),
        (name = "Render", description = "Resume rendering to PDF/PNG"),
        (name = "Validate", description = "Resume validation")
    )
)]
pub struct ApiDoc;
