//! Public resume pages for social sharing and unauthenticated viewing.

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use rustume_render::Renderer;
use rustume_schema::ResumeData;
use serde::Serialize;
use sqlx::FromRow;
use tracing::error;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::config::public_base_url;
use crate::error::ApiError;
use crate::state::AppState;

const OG_DESCRIPTION_MAX_CHARS: usize = 200;
const PREVIEW_CACHE_MAX_AGE: u64 = 3600;

const ROBOTS_TXT: &str = "\
User-agent: *
Allow: /r/
Disallow: /api/
";

#[derive(Debug, Clone, FromRow)]
struct PublicResumeRow {
    id: Uuid,
    title: String,
    data: serde_json::Value,
    version: i32,
    updated_at: DateTime<Utc>,
}

/// Public resume payload for the SPA view.
#[derive(Debug, Serialize, ToSchema)]
pub struct PublicResumeData {
    #[schema(value_type = String, format = "uuid")]
    pub id: Uuid,
    pub title: String,
    #[schema(value_type = Object)]
    pub data: serde_json::Value,
    #[schema(value_type = String, format = "date-time")]
    pub updated_at: DateTime<Utc>,
}

/// HTML-escape user-controlled values injected into `<meta>` tags.
pub fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Format an HTTP ETag from resume id and optimistic-lock version.
pub fn format_etag(id: Uuid, version: i32) -> String {
    format!("\"{id}-{version}\"")
}

fn strip_html_tags(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }
    result
}

fn truncate_description(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let truncated: String = trimmed.chars().take(max_chars).collect();
    format!("{truncated}...")
}

fn og_title(name: &str, fallback_title: &str) -> String {
    let display_name = name.trim();
    if display_name.is_empty() {
        format!("{} — Resume", fallback_title.trim())
    } else {
        format!("{display_name} — Resume")
    }
}

fn og_description(resume: &ResumeData) -> String {
    let headline = resume.basics.headline.trim();
    if !headline.is_empty() {
        return truncate_description(headline, OG_DESCRIPTION_MAX_CHARS);
    }
    let summary = strip_html_tags(&resume.sections.summary.content);
    truncate_description(&summary, OG_DESCRIPTION_MAX_CHARS)
}

fn absolute_url(base: Option<&str>, path: &str) -> String {
    match base {
        Some(base) => format!("{base}{path}"),
        None => path.to_string(),
    }
}

fn build_og_meta_tags(
    row: &PublicResumeRow,
    resume: &ResumeData,
    slug: &str,
    base_url: Option<&str>,
) -> String {
    let title = escape_html(&og_title(&resume.basics.name, &row.title));
    let description = escape_html(&og_description(resume));
    let page_path = format!("/r/{slug}");
    let preview_path = format!("/r/{slug}/preview.png");
    let url = escape_html(&absolute_url(base_url, &page_path));
    let image = escape_html(&absolute_url(base_url, &preview_path));

    format!(
        r#"<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{image}">
<meta property="og:url" content="{url}">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary_large_image">"#
    )
}

/// Inject Open Graph meta tags immediately before `</head>`.
pub fn inject_og_tags(html: &str, meta_tags: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let pos = lower.find("</head>")?;
    let mut result = String::with_capacity(html.len() + meta_tags.len() + 1);
    result.push_str(&html[..pos]);
    result.push_str(meta_tags);
    result.push('\n');
    result.push_str(&html[pos..]);
    Some(result)
}

async fn fetch_public_resume(state: &AppState, slug: &str) -> Result<PublicResumeRow, ApiError> {
    let cloud = state.cloud()?;
    sqlx::query_as::<_, PublicResumeRow>(
        r#"
        SELECT id, title, data, version, updated_at
        FROM resumes
        WHERE public_slug = $1 AND is_public = true
        "#,
    )
    .bind(slug)
    .fetch_optional(&cloud.db)
    .await
    .map_err(internal_db_error)?
    .ok_or_else(|| ApiError::not_found("Resume not found"))
}

fn internal_db_error(err: impl std::fmt::Display + Send + Sync + 'static) -> ApiError {
    error!("public resume database error: {err}");
    ApiError::internal("internal server error")
}

fn parse_resume_data(data: &serde_json::Value) -> Result<ResumeData, ApiError> {
    serde_json::from_value(data.clone())
        .map_err(|_| ApiError::internal("Invalid resume data in database"))
}

fn etag_entity_tag(candidate: &str) -> &str {
    let trimmed = candidate.trim();
    let without_weak = trimmed.strip_prefix("W/").unwrap_or(trimmed);
    without_weak.trim_matches('"')
}

fn etag_matches(if_none_match: &str, etag: &str) -> bool {
    if if_none_match.trim() == "*" {
        return true;
    }
    let entity = etag_entity_tag(etag);
    if_none_match
        .split(',')
        .any(|candidate| etag_entity_tag(candidate) == entity)
}

/// Serve `GET /robots.txt` for crawlers.
pub async fn robots_txt() -> Response {
    (
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        )],
        ROBOTS_TXT,
    )
        .into_response()
}

/// Serve a published resume as HTML with Open Graph meta tags.
#[utoipa::path(
    get,
    path = "/r/{slug}",
    tag = "Public",
    params(("slug" = String, Path, description = "Public resume slug")),
    responses(
        (status = 200, description = "HTML page with OG meta tags", content_type = "text/html"),
        (status = 404, description = "Resume not found or not public", body = ApiError)
    )
)]
pub async fn public_resume_page(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response, ApiError> {
    let row = fetch_public_resume(&state, &slug).await?;
    let resume = parse_resume_data(&row.data)?;
    let base_url = public_base_url();
    let meta_tags = build_og_meta_tags(&row, &resume, &slug, base_url.as_deref());

    let index_path = state.static_dir.join("index.html");
    let html = tokio::fs::read_to_string(&index_path)
        .await
        .map_err(|err| ApiError::internal(format!("Failed to read index.html: {err}")))?;

    let html = inject_og_tags(&html, &meta_tags).ok_or_else(|| {
        ApiError::internal("index.html is missing a </head> element for OG injection")
    })?;

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CACHE_CONTROL, "no-cache"),
        ],
        html,
    )
        .into_response())
}

/// Serve a cached PNG preview of page 1 for a published resume.
#[utoipa::path(
    get,
    path = "/r/{slug}/preview.png",
    tag = "Public",
    params(("slug" = String, Path, description = "Public resume slug")),
    responses(
        (status = 200, description = "PNG preview image", content_type = "image/png"),
        (status = 304, description = "Not modified"),
        (status = 404, description = "Resume not found or not public", body = ApiError)
    )
)]
pub async fn public_resume_preview(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    let row = fetch_public_resume(&state, &slug).await?;
    let etag = format_etag(row.id, row.version);

    if let Some(if_none_match) = headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
    {
        if etag_matches(if_none_match, &etag) {
            return Ok((
                StatusCode::NOT_MODIFIED,
                [(
                    header::ETAG,
                    HeaderValue::from_str(&etag)
                        .map_err(|err| ApiError::internal(format!("invalid ETag header: {err}")))?,
                )],
            )
                .into_response());
        }
    }

    let resume = parse_resume_data(&row.data)?;
    let renderer = state.renderer.clone();

    let png = tokio::task::spawn_blocking(move || {
        renderer
            .render_preview(&resume, 0)
            .map(|(bytes, _)| bytes)
            .map_err(|err| format!("Failed to render preview: {err}"))
    })
    .await
    .map_err(|err| ApiError::internal(format!("Render task failed: {err}")))?
    .map_err(ApiError::internal)?;

    let cache_control = format!("public, max-age={PREVIEW_CACHE_MAX_AGE}");
    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, cache_control.as_str()),
            (header::ETAG, etag.as_str()),
        ],
        png,
    )
        .into_response())
}

/// Serve public JSON resume data for the SPA view.
#[utoipa::path(
    get,
    path = "/r/{slug}/data",
    tag = "Public",
    params(("slug" = String, Path, description = "Public resume slug")),
    responses(
        (status = 200, description = "Public resume data", body = PublicResumeData),
        (status = 404, description = "Resume not found or not public", body = ApiError)
    )
)]
pub async fn public_resume_data(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicResumeData>, ApiError> {
    let row = fetch_public_resume(&state, &slug).await?;
    Ok(Json(PublicResumeData {
        id: row.id,
        title: row.title,
        data: row.data,
        updated_at: row.updated_at,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::uuid;

    #[test]
    fn escape_html_handles_special_characters() {
        assert_eq!(
            escape_html(r#"<script>alert("xss")</script> & 'test'"#),
            "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;test&#39;"
        );
    }

    #[test]
    fn format_etag_quotes_id_and_version() {
        let id = uuid!("550e8400-e29b-41d4-a716-446655440000");
        assert_eq!(
            format_etag(id, 3),
            "\"550e8400-e29b-41d4-a716-446655440000-3\""
        );
    }

    #[test]
    fn inject_og_tags_inserts_before_head_close() {
        let html = "<html><head><title>Resume</title></head><body></body></html>";
        let meta = r#"<meta property="og:title" content="Test">"#;
        let result = inject_og_tags(html, meta).expect("injection should succeed");
        assert!(result.contains("<meta property=\"og:title\" content=\"Test\">"));
        assert!(result.contains("</head>"));
        let head_end = result.find("</head>").expect("head close");
        let meta_pos = result.find(meta).expect("meta tag");
        assert!(meta_pos < head_end);
    }

    #[test]
    fn inject_og_tags_escapes_hostile_resume_name() {
        let hostile = "<script>alert(1)</script>";
        let escaped = escape_html(hostile);
        let meta = format!(r#"<meta property="og:title" content="{escaped}">"#);
        let html = "<html><head></head><body></body></html>";
        let result = inject_og_tags(html, &meta).expect("injection should succeed");
        assert!(!result.contains("<script>alert(1)</script>"));
        assert!(result.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
    }

    #[test]
    fn og_description_truncates_long_headline() {
        let long_headline = "a".repeat(250);
        let mut resume = ResumeData::default();
        resume.basics.headline = long_headline;
        let description = og_description(&resume);
        assert!(description.chars().count() <= OG_DESCRIPTION_MAX_CHARS + 3);
        assert!(description.ends_with("..."));
    }

    #[test]
    fn og_description_falls_back_to_summary_content() {
        let mut resume = ResumeData::default();
        resume.sections.summary.content =
            "<p>Experienced engineer building cloud systems.</p>".into();
        let description = og_description(&resume);
        assert_eq!(description, "Experienced engineer building cloud systems.");
    }

    #[test]
    fn etag_matches_supports_comma_separated_values() {
        let etag = format_etag(uuid!("550e8400-e29b-41d4-a716-446655440000"), 2);
        assert!(etag_matches(&etag, &etag));
        assert!(etag_matches(
            "W/\"other\", 550e8400-e29b-41d4-a716-446655440000-2",
            &etag
        ));
        assert!(etag_matches(
            "W/\"550e8400-e29b-41d4-a716-446655440000-2\"",
            &etag
        ));
    }

    #[test]
    fn etag_matches_honors_wildcard() {
        let etag = format_etag(uuid!("550e8400-e29b-41d4-a716-446655440000"), 2);
        assert!(etag_matches("*", &etag));
        assert!(etag_matches("  *  ", &etag));
        assert!(!etag_matches("\"other\"", &etag));
    }

    #[test]
    fn build_og_meta_tags_uses_relative_urls_without_public_base_url() {
        let row = PublicResumeRow {
            id: uuid!("550e8400-e29b-41d4-a716-446655440000"),
            title: "Resume".into(),
            data: serde_json::Value::Null,
            version: 1,
            updated_at: Utc::now(),
        };
        let resume = ResumeData::default();
        let meta = build_og_meta_tags(&row, &resume, "foo", None);

        assert!(meta.contains(r#"content="/r/foo""#));
        assert!(meta.contains(r#"content="/r/foo/preview.png""#));
    }

    #[test]
    fn build_og_meta_tags_uses_configured_public_base_url() {
        let row = PublicResumeRow {
            id: uuid!("550e8400-e29b-41d4-a716-446655440000"),
            title: "Resume".into(),
            data: serde_json::Value::Null,
            version: 1,
            updated_at: Utc::now(),
        };
        let resume = ResumeData::default();
        let meta = build_og_meta_tags(&row, &resume, "foo", Some("https://rustume.com"));

        assert!(meta.contains(r#"content="https://rustume.com/r/foo""#));
        assert!(meta.contains(r#"content="https://rustume.com/r/foo/preview.png""#));
    }
}
