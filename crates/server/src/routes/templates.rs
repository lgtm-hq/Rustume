use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use lru::LruCache;
use rustume_render::{get_template_theme, Renderer, TEMPLATES};
use rustume_schema::ResumeData;
use std::num::NonZeroUsize;
use std::sync::OnceLock;
use tokio::sync::Mutex as AsyncMutex;

use crate::dto::{TemplateInfo, ThemeInfo};
use crate::error::ApiError;
use crate::state::AppState;

/// Maximum number of template thumbnails to cache
const THUMBNAIL_CACHE_CAPACITY: usize = 32;

/// Cache for rendered template thumbnails (keyed by template name, bounded LRU)
fn thumbnail_cache() -> &'static AsyncMutex<LruCache<String, Vec<u8>>> {
    static CACHE: OnceLock<AsyncMutex<LruCache<String, Vec<u8>>>> = OnceLock::new();
    CACHE.get_or_init(|| {
        AsyncMutex::new(LruCache::new(
            NonZeroUsize::new(THUMBNAIL_CACHE_CAPACITY).unwrap(),
        ))
    })
}

/// Create a sample resume with realistic placeholder data for thumbnails.
fn create_sample_resume() -> ResumeData {
    use rustume_schema::*;

    let mut resume = ResumeData::default();
    resume.basics.name = "John Doe".to_string();
    resume.basics.headline = "Senior Software Engineer".to_string();
    resume.basics.email = "john@example.com".to_string();
    resume.basics.phone = "+1 (555) 123-4567".to_string();
    resume.basics.location = "San Francisco, CA".to_string();
    resume.basics.url = Url::with_label("Portfolio", "https://johndoe.dev");

    resume.sections.summary = SummarySection::new(
        "Experienced software engineer with 8+ years building scalable web applications. \
         Expert in React, TypeScript, and cloud architecture. Led teams of 5-10 engineers.",
    );

    resume.sections.experience.add_item(
        Experience::new("TechCorp Inc.", "Senior Software Engineer")
            .with_location("San Francisco, CA")
            .with_date("2020 - Present")
            .with_summary(
                "Lead development of core platform serving 2M+ daily active users. \
                 Architected microservices reducing latency by 40%.",
            ),
    );
    resume.sections.experience.add_item(
        Experience::new("StartupXYZ", "Software Engineer")
            .with_location("Remote")
            .with_date("2017 - 2020")
            .with_summary(
                "Built real-time collaboration features from scratch. \
                 Implemented CI/CD pipelines reducing deployment time by 70%.",
            ),
    );

    resume.sections.education.add_item(
        Education::new("Stanford University", "Computer Science")
            .with_study_type("Bachelor of Science")
            .with_date("2013 - 2017")
            .with_score("GPA: 3.9/4.0"),
    );

    resume
        .sections
        .skills
        .add_item(Skill::new("TypeScript / JavaScript").with_level(5));
    resume
        .sections
        .skills
        .add_item(Skill::new("React / Next.js").with_level(5));
    resume
        .sections
        .skills
        .add_item(Skill::new("Node.js / Python").with_level(4));
    resume
        .sections
        .skills
        .add_item(Skill::new("PostgreSQL / Redis").with_level(4));

    resume
        .sections
        .profiles
        .add_item(Profile::new("GitHub", "johndoe").with_url("https://github.com/johndoe"));
    resume
        .sections
        .profiles
        .add_item(Profile::new("LinkedIn", "johndoe").with_url("https://linkedin.com/in/johndoe"));

    resume
}

/// List available templates
///
/// Returns a list of all available resume templates with their theme colors.
#[utoipa::path(
    get,
    path = "/api/templates",
    tag = "Templates",
    responses(
        (status = 200, description = "List of available templates", body = Vec<TemplateInfo>)
    )
)]
pub async fn list_templates() -> Json<Vec<TemplateInfo>> {
    let templates: Vec<TemplateInfo> = TEMPLATES
        .iter()
        .map(|name| {
            let theme = get_template_theme(name);
            // Capitalize first letter for display name
            let display_name = {
                let mut chars = name.chars();
                match chars.next() {
                    None => String::new(),
                    Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                }
            };
            TemplateInfo {
                id: name.to_string(),
                name: display_name,
                theme: ThemeInfo {
                    background: theme.background.clone(),
                    text: theme.text.clone(),
                    primary: theme.primary.clone(),
                },
            }
        })
        .collect();

    Json(templates)
}

/// Get template thumbnail
///
/// Returns a pre-rendered PNG thumbnail of the template with sample data.
#[utoipa::path(
    get,
    path = "/api/templates/{id}/thumbnail",
    tag = "Templates",
    params(
        ("id" = String, Path, description = "Template ID")
    ),
    responses(
        (status = 200, description = "PNG thumbnail image", content_type = "image/png"),
        (status = 404, description = "Template not found", body = ApiError)
    )
)]
pub async fn template_thumbnail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    // Verify template exists
    if !TEMPLATES.contains(&id.as_str()) {
        return Err(ApiError::not_found(format!("Template '{}' not found", id)));
    }

    // Check cache (clone inside lock, respond outside)
    let cached = {
        let mut cache = thumbnail_cache().lock().await;
        cache.get(&id).cloned()
    };
    if let Some(png) = cached {
        return Ok((
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "image/png"),
                (header::CACHE_CONTROL, "public, max-age=86400"),
            ],
            png,
        )
            .into_response());
    }

    // Render thumbnail with sample data
    let mut resume = create_sample_resume();
    resume.metadata.template = id.clone();
    let theme = get_template_theme(&id);
    resume.metadata.theme.primary = theme.primary.clone();
    resume.metadata.theme.text = theme.text.clone();
    resume.metadata.theme.background = theme.background.clone();

    let renderer = state.renderer.clone();
    let (png, _total_pages) = tokio::task::spawn_blocking(move || {
        renderer
            .render_preview(&resume, 0)
            .map_err(|e| format!("Failed to render thumbnail: {e}"))
    })
    .await
    .map_err(|err| ApiError::internal(format!("Render task failed: {err}")))?
    .map_err(ApiError::internal)?;

    // Cache the result
    {
        let mut cache = thumbnail_cache().lock().await;
        cache.put(id, png.clone());
    }

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        png,
    )
        .into_response())
}
