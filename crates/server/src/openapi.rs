//! OpenAPI specification for the Rustume HTTP API.

use utoipa::openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::Modify;
use utoipa::OpenApi;

use crate::db::{
    ApiKeySummary, AuthMeUnauthorizedResponse, AuthUserResponse, CreateApiKeyRequest,
    CreateApiKeyResponse, CreateResumeRequest, DeleteAccountRequest, DeleteAccountResponse,
    ImportFailure, ImportResumeItem, ImportResumesRequest, ImportResumesResponse,
    PaginatedResumeSummaries, ResumeBulkExport, ResumeExportItem, ResumeListQuery, ResumeRow,
    ResumeSummary, SubscriptionInfo, UpdateResumeRequest,
};
use crate::dto::{
    ParseFormat, ParseRequest, RenderPdfRequest, RenderPreviewRequest, TemplateInfo, ThemeInfo,
    ValidationResponse,
};
use crate::error::ApiError;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "cookieAuth",
                SecurityScheme::ApiKey(ApiKey::Cookie(ApiKeyValue::new("rustume_session"))),
            );
            components.add_security_scheme(
                "bearerAuth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("API key")
                        .description(Some(
                            "API key token issued via POST /api/keys (prefix `rk_`).",
                        ))
                        .build(),
                ),
            );
            components.add_security_scheme(
                "apiKeyHeader",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::with_description(
                    "x-api-key",
                    "API key token issued via POST /api/keys (prefix `rk_`).",
                ))),
            );
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Rustume API",
        version = env!("CARGO_PKG_VERSION"),
        description = "REST API for resume parsing, rendering, validation, and Rustume Cloud storage.\n\n## Features\n\n- **Parse**: Import resumes from JSON Resume, LinkedIn exports, or Reactive Resume v3\n- **Render**: Generate PDF or PNG previews of resumes\n- **Validate**: Check resume data against the schema\n- **Templates**: List available resume templates with theme colors\n- **Cloud** (when enabled): WorkOS auth, API keys, and authenticated resume CRUD",
        license(name = "AGPL-3.0-only", url = "https://www.gnu.org/licenses/agpl-3.0.en.html"),
        contact(name = "Rustume", url = "https://github.com/lgtm-hq/Rustume")
    ),
    servers(
        (url = "/", description = "Local server")
    ),
    modifiers(&SecurityAddon),
    paths(
        crate::routes::health::health,
        crate::routes::templates::list_templates,
        crate::routes::templates::template_thumbnail,
        crate::routes::parse::parse,
        crate::routes::render::render_pdf,
        crate::routes::render::render_preview,
        crate::routes::validate::validate,
        crate::routes::auth::me,
        crate::routes::resumes::list_resumes,
        crate::routes::resumes::get_resume,
        crate::routes::resumes::create_resume,
        crate::routes::resumes::update_resume,
        crate::routes::resumes::delete_resume,
        crate::routes::resumes::import_resumes,
        crate::routes::export::export_resumes_json,
        crate::routes::export::export_resumes_pdf,
        crate::routes::account::delete_account,
        crate::routes::api_keys::create_api_key,
        crate::routes::api_keys::list_api_keys,
        crate::routes::api_keys::revoke_api_key,
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
            AuthUserResponse,
            AuthMeUnauthorizedResponse,
            SubscriptionInfo,
            ResumeBulkExport,
            ResumeExportItem,
            ResumeSummary,
            PaginatedResumeSummaries,
            ResumeListQuery,
            ResumeRow,
            CreateResumeRequest,
            UpdateResumeRequest,
            ImportResumesRequest,
            ImportResumesResponse,
            ImportFailure,
            ImportResumeItem,
            DeleteAccountRequest,
            DeleteAccountResponse,
            CreateApiKeyRequest,
            CreateApiKeyResponse,
            ApiKeySummary,
            rustume_schema::ResumeData
        )
    ),
    tags(
        (name = "Health", description = "Health check endpoints"),
        (name = "Templates", description = "Template management"),
        (name = "Parse", description = "Resume parsing from various formats"),
        (name = "Render", description = "Resume rendering to PDF/PNG"),
        (name = "Validate", description = "Resume validation"),
        (name = "Auth", description = "Rustume Cloud authentication (cloud mode only)"),
        (name = "Resumes", description = "Authenticated resume storage (cloud mode only)"),
        (name = "Account", description = "Account lifecycle (cloud mode only)"),
        (name = "API Keys", description = "API key management (session auth only, cloud mode)")
    )
)]
/// Generated OpenAPI document served at `/api-docs/openapi.json`.
pub struct ApiDoc;
