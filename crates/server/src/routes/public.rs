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
use tracing::{debug, error};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::config::public_base_url;
use crate::error::ApiError;
use crate::state::AppState;

const OG_DESCRIPTION_MAX_CHARS: usize = 200;

/// Caches may store the PNG but must revalidate with `If-None-Match` on every
/// reuse, so unpublishing or a version bump takes effect immediately while
/// unchanged previews still cost only a cheap `304`.
const PREVIEW_CACHE_CONTROL: &str = "public, no-cache";

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

/// Build the Open Graph `<meta>` block for a public resume.
///
/// `og:url` and `og:image` must be absolute URLs for social crawlers, and the
/// server never trusts request `Host` headers to build them. When
/// `PUBLIC_BASE_URL` is unset the tags are omitted (rather than emitted as
/// relative paths that crawlers reject) and the card degrades to `summary`.
fn build_og_meta_tags(
    row: &PublicResumeRow,
    resume: &ResumeData,
    slug: &str,
    base_url: Option<&str>,
) -> String {
    let title = escape_html(&og_title(&resume.basics.name, &row.title));
    let description = escape_html(&og_description(resume));

    let Some(base) = base_url else {
        return format!(
            r#"<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary">"#
        );
    };

    let url = escape_html(&format!("{base}/r/{slug}"));
    let image = escape_html(&format!("{base}/r/{slug}/preview.png"));

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

/// Look up a published resume by slug.
///
/// Password-protected pages (#81) are not implemented yet: the sharing API
/// cannot set `password_hash`, and until a gate exists any row that somehow
/// carries one is treated as not public rather than served in the clear.
async fn fetch_public_resume(state: &AppState, slug: &str) -> Result<PublicResumeRow, ApiError> {
    let cloud = state.cloud()?;
    sqlx::query_as::<_, PublicResumeRow>(
        r#"
        SELECT id, title, data, version, updated_at
        FROM resumes
        WHERE public_slug = $1
          AND is_public = true
          AND password_hash IS NULL
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
    // The weak-validator prefix is case-insensitive (RFC 9110 §8.8.3).
    let without_weak = trimmed
        .strip_prefix("W/")
        .or_else(|| trimmed.strip_prefix("w/"))
        .unwrap_or(trimmed);
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
///
/// A `robots.txt` shipped in the static bundle wins, so self-hosted operators
/// keep full control; the built-in policy is only the fallback.
pub async fn robots_txt(State(state): State<AppState>) -> Result<Response, ApiError> {
    let path = state.static_dir.join("robots.txt");
    let body = match tokio::fs::read_to_string(&path).await {
        Ok(custom) => custom,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => ROBOTS_TXT.to_string(),
        Err(err) => {
            // An operator file exists but cannot be read: do not silently fall
            // back to a permissive policy.
            error!("robots.txt: failed to read {}: {err}", path.display());
            return Err(ApiError::internal("Failed to read robots.txt"));
        }
    };
    Ok((
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            HeaderValue::from_static("text/plain; charset=utf-8"),
        )],
        body,
    )
        .into_response())
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
    if base_url.is_none() {
        // Startup already warned once; keep the per-request signal at debug so
        // crawler traffic cannot flood the logs with a static configuration fact.
        debug!("PUBLIC_BASE_URL is unset; serving /r/{slug} without og:url and og:image");
    }
    let meta_tags = build_og_meta_tags(&row, &resume, &slug, base_url.as_deref());

    let index_path = state.static_dir.join("index.html");
    let html = tokio::fs::read_to_string(&index_path)
        .await
        .map_err(|err| {
            error!(
                "public page: failed to read {}: {err}",
                index_path.display()
            );
            ApiError::internal("Failed to render public page")
        })?;

    let html = inject_og_tags(&html, &meta_tags).ok_or_else(|| {
        error!(
            "public page: {} has no </head> element for OG injection",
            index_path.display()
        );
        ApiError::internal("Failed to render public page")
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

    // This route is anonymous: log the raw Typst/task diagnostics server-side
    // and return a fixed message so nothing about the document leaks.
    let png = tokio::task::spawn_blocking(move || {
        renderer.render_preview(&resume, 0).map(|(bytes, _)| bytes)
    })
    .await
    .map_err(|err| {
        error!("public preview render task failed for {slug}: {err}");
        ApiError::internal("Failed to render preview")
    })?
    .map_err(|err| {
        error!("public preview render failed for {slug}: {err}");
        ApiError::internal("Failed to render preview")
    })?;

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, PREVIEW_CACHE_CONTROL),
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
) -> Result<Response, ApiError> {
    let row = fetch_public_resume(&state, &slug).await?;
    let etag = format_etag(row.id, row.version);
    let payload = PublicResumeData {
        id: row.id,
        title: row.title,
        data: row.data,
        updated_at: row.updated_at,
    };
    // Same unpublish contract as the HTML page: never serve from cache
    // without revalidation.
    Ok((
        StatusCode::OK,
        [
            (header::CACHE_CONTROL, "no-cache"),
            (header::ETAG, etag.as_str()),
        ],
        Json(payload),
    )
        .into_response())
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
        assert!(etag_matches(
            "w/\"550e8400-e29b-41d4-a716-446655440000-2\"",
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
    fn build_og_meta_tags_omits_url_and_image_without_public_base_url() {
        let row = PublicResumeRow {
            id: uuid!("550e8400-e29b-41d4-a716-446655440000"),
            title: "Resume".into(),
            data: serde_json::Value::Null,
            version: 1,
            updated_at: Utc::now(),
        };
        let resume = ResumeData::default();
        let meta = build_og_meta_tags(&row, &resume, "foo", None);

        assert!(meta.contains(r#"property="og:title""#));
        assert!(meta.contains(r#"property="og:description""#));
        assert!(!meta.contains("og:url"));
        assert!(!meta.contains("og:image"));
        assert!(!meta.contains("/r/foo"));
        assert!(meta.contains(r#"name="twitter:card" content="summary""#));
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

    mod handlers {
        //! Cloud-mode handler tests. Skipped unless `TEST_DATABASE_URL` points at a
        //! database whose name contains `_test` (same convention as resume tests).

        use super::*;
        use crate::app::create_router_with_state;
        use crate::auth::session::SessionService;
        use crate::auth::workos::WorkOsClient;
        use crate::cloud::CloudState;
        use crate::error::ApiErrorKind;
        use axum::body::Body;
        use axum::http::Request;
        use sqlx::postgres::PgPoolOptions;
        use std::sync::Arc;
        use tower::ServiceExt;

        fn database_url_for_tests() -> Option<String> {
            let url = std::env::var("TEST_DATABASE_URL")
                .ok()
                .or_else(|| std::env::var("DATABASE_URL").ok())
                .map(|url| url.trim().to_owned())
                .filter(|url| !url.is_empty())?;
            let db_name = url
                .split(['?', '#'])
                .next()
                .unwrap_or(&url)
                .rsplit('/')
                .next()
                .unwrap_or("");
            if db_name.contains("_test") {
                Some(url)
            } else {
                eprintln!("SKIP public route integration tests: TEST_DATABASE_URL must name a *_test database");
                None
            }
        }

        async fn connect_test_pool(database_url: &str) -> sqlx::PgPool {
            let pool = PgPoolOptions::new()
                .max_connections(2)
                .connect(database_url)
                .await
                .expect("connect to test database");
            sqlx::migrate!("./src/db/migrations")
                .run(&pool)
                .await
                .expect("run migrations");
            pool
        }

        struct Seeded {
            user_id: Uuid,
            slug: String,
            version: i32,
            resume_id: Uuid,
        }

        /// Sets `PUBLIC_BASE_URL` for one test and restores the prior value on drop,
        /// including when the test panics. Tests using it are serialized by a mutex
        /// because the environment is process-global.
        struct PublicBaseUrlGuard {
            previous: Option<String>,
            _lock: std::sync::MutexGuard<'static, ()>,
        }

        static PUBLIC_BASE_URL_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

        impl PublicBaseUrlGuard {
            fn set(value: &str) -> Self {
                let lock = PUBLIC_BASE_URL_LOCK
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                let previous = std::env::var("PUBLIC_BASE_URL").ok();
                std::env::set_var("PUBLIC_BASE_URL", value);
                Self {
                    previous,
                    _lock: lock,
                }
            }
        }

        impl Drop for PublicBaseUrlGuard {
            fn drop(&mut self) {
                match self.previous.take() {
                    Some(previous) => std::env::set_var("PUBLIC_BASE_URL", previous),
                    None => std::env::remove_var("PUBLIC_BASE_URL"),
                }
            }
        }

        async fn seed_resume(pool: &sqlx::PgPool, is_public: bool) -> Seeded {
            seed_resume_with_password(pool, is_public, None).await
        }

        async fn seed_resume_with_password(
            pool: &sqlx::PgPool,
            is_public: bool,
            password_hash: Option<&str>,
        ) -> Seeded {
            let user_id = Uuid::new_v4();
            sqlx::query("INSERT INTO users (id, workos_id) VALUES ($1, $2)")
                .bind(user_id)
                .bind(format!("workos_public_{user_id}"))
                .execute(pool)
                .await
                .expect("insert user");

            let slug = format!("pub_{}", Uuid::new_v4().simple());
            let mut resume = ResumeData::default();
            resume.basics.name = "Ada Lovelace".into();
            resume.basics.headline = "Analytical engine programmer".into();
            let data = serde_json::to_value(&resume).expect("serialize resume");

            let (resume_id, version): (Uuid, i32) = sqlx::query_as(
                r#"
                INSERT INTO resumes (user_id, title, data, is_public, public_slug, password_hash)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, version
                "#,
            )
            .bind(user_id)
            .bind("Public Test")
            .bind(data)
            .bind(is_public)
            .bind(&slug)
            .bind(password_hash)
            .fetch_one(pool)
            .await
            .expect("insert resume");

            Seeded {
                user_id,
                slug,
                version,
                resume_id,
            }
        }

        async fn cleanup_user(pool: &sqlx::PgPool, user_id: Uuid) {
            sqlx::query("DELETE FROM users WHERE id = $1")
                .bind(user_id)
                .execute(pool)
                .await
                .expect("cleanup user");
        }

        fn test_app_state(pool: sqlx::PgPool, static_dir: std::path::PathBuf) -> AppState {
            let sessions_pool = pool.clone();
            AppState::with_require_auth(
                Arc::new(static_dir),
                Some(Arc::new(CloudState {
                    db: pool,
                    workos: WorkOsClient::new("client_test".into(), "api_key_test".into()),
                    sessions: SessionService::new(
                        sessions_pool,
                        "test-session-secret-at-least-32-chars".into(),
                        false,
                    ),
                    workos_redirect_uri: "http://localhost/auth/callback".into(),
                    email: None,
                })),
                false,
            )
        }

        fn temp_static_dir() -> tempfile::TempDir {
            let dir = tempfile::tempdir().expect("temp static dir");
            std::fs::write(
                dir.path().join("index.html"),
                "<!doctype html><html><head><title>Rustume</title></head><body></body></html>",
            )
            .expect("write index.html");
            dir
        }

        async fn body_string(response: Response) -> String {
            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read body");
            String::from_utf8(bytes.to_vec()).expect("utf8 body")
        }

        #[tokio::test]
        async fn public_page_serves_html_with_escaped_og_tags() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let app = create_router_with_state(test_app_state(
                pool.clone(),
                static_dir.path().to_path_buf(),
            ));

            let response = app
                .oneshot(
                    Request::builder()
                        .uri(format!("/r/{}", seeded.slug))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
            assert!(response
                .headers()
                .get(header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v.starts_with("text/html")));
            let html = body_string(response).await;
            assert!(html.contains(r#"<meta property="og:title" content="Ada Lovelace — Resume">"#));
            assert!(html.contains(
                r#"<meta property="og:description" content="Analytical engine programmer">"#
            ));
            assert!(html.contains("</head>"));

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn unpublished_resume_is_not_found_on_every_public_route() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, false).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());

            let page = public_resume_page(State(state.clone()), Path(seeded.slug.clone()))
                .await
                .expect_err("unpublished page should 404");
            assert!(matches!(page.kind, ApiErrorKind::NotFound));

            let data = public_resume_data(State(state.clone()), Path(seeded.slug.clone()))
                .await
                .expect_err("unpublished data should 404");
            assert!(matches!(data.kind, ApiErrorKind::NotFound));

            let preview = public_resume_preview(
                State(state.clone()),
                Path(seeded.slug.clone()),
                HeaderMap::new(),
            )
            .await
            .expect_err("unpublished preview should 404");
            assert!(matches!(preview.kind, ApiErrorKind::NotFound));

            let missing = public_resume_data(State(state), Path("does-not-exist".into()))
                .await
                .expect_err("unknown slug should 404");
            assert!(matches!(missing.kind, ApiErrorKind::NotFound));

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn public_data_returns_published_resume_without_owner_fields() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());

            let response = public_resume_data(State(state), Path(seeded.slug.clone()))
                .await
                .expect("published data");
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(
                response.headers().get(header::CACHE_CONTROL).unwrap(),
                "no-cache"
            );
            assert_eq!(
                response.headers().get(header::ETAG).unwrap(),
                format_etag(seeded.resume_id, seeded.version).as_str()
            );
            let json: serde_json::Value =
                serde_json::from_str(&body_string(response).await).expect("json body");
            assert_eq!(json["id"], seeded.resume_id.to_string());
            assert_eq!(json["title"], "Public Test");
            assert!(json.get("user_id").is_none());
            assert!(json.get("password_hash").is_none());

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn preview_returns_304_for_matching_etag_without_rendering() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());
            let etag = format_etag(seeded.resume_id, seeded.version);

            for candidate in [
                etag.clone(),
                format!("W/{etag}"),
                format!("w/{etag}"),
                "*".into(),
            ] {
                let mut headers = HeaderMap::new();
                headers.insert(header::IF_NONE_MATCH, candidate.parse().unwrap());
                let response =
                    public_resume_preview(State(state.clone()), Path(seeded.slug.clone()), headers)
                        .await
                        .expect("preview");
                assert_eq!(response.status(), StatusCode::NOT_MODIFIED, "{candidate}");
                assert_eq!(
                    response
                        .headers()
                        .get(header::ETAG)
                        .unwrap()
                        .to_str()
                        .unwrap(),
                    etag
                );
            }

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn public_page_emits_absolute_og_urls_when_base_url_is_configured() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let _env = PublicBaseUrlGuard::set("https://rustume.example/");
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());

            let response = public_resume_page(State(state), Path(seeded.slug.clone()))
                .await
                .expect("public page");
            assert_eq!(response.status(), StatusCode::OK);
            let html = body_string(response).await;
            let slug = &seeded.slug;
            assert!(html.contains(&format!(
                r#"<meta property="og:url" content="https://rustume.example/r/{slug}">"#
            )));
            assert!(html.contains(&format!(
                r#"<meta property="og:image" content="https://rustume.example/r/{slug}/preview.png">"#
            )));
            assert!(html.contains(r#"<meta name="twitter:card" content="summary_large_image">"#));

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn preview_renders_png_with_etag_on_cache_miss() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());
            let etag = format_etag(seeded.resume_id, seeded.version);

            let mut stale = HeaderMap::new();
            stale.insert(header::IF_NONE_MATCH, "\"stale-etag\"".parse().unwrap());
            let response =
                public_resume_preview(State(state.clone()), Path(seeded.slug.clone()), stale)
                    .await
                    .expect("preview render");

            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(
                response.headers().get(header::CONTENT_TYPE).unwrap(),
                "image/png"
            );
            assert_eq!(response.headers().get(header::ETAG).unwrap(), etag.as_str());
            assert_eq!(
                response.headers().get(header::CACHE_CONTROL).unwrap(),
                PREVIEW_CACHE_CONTROL
            );
            let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("png body");
            assert!(
                bytes.starts_with(&[0x89, b'P', b'N', b'G']),
                "body should be a PNG"
            );

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn password_protected_rows_are_not_served_publicly() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume_with_password(&pool, true, Some("$argon2id$hash")).await;
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());

            let err = public_resume_data(State(state), Path(seeded.slug.clone()))
                .await
                .expect_err("password-protected row must not be public");
            assert!(matches!(err.kind, ApiErrorKind::NotFound));

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn router_serves_data_and_preview_and_reserves_r_namespace_in_cloud_mode() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;
            let static_dir = temp_static_dir();
            let app = create_router_with_state(test_app_state(
                pool.clone(),
                static_dir.path().to_path_buf(),
            ));
            let etag = format_etag(seeded.resume_id, seeded.version);

            let data = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(format!("/r/{}/data", seeded.slug))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(data.status(), StatusCode::OK);
            assert_eq!(
                data.headers().get(header::CACHE_CONTROL).unwrap(),
                "no-cache"
            );

            let preview_304 = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(format!("/r/{}/preview.png", seeded.slug))
                        .header(header::IF_NONE_MATCH, &etag)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(preview_304.status(), StatusCode::NOT_MODIFIED);

            // A stale validator (previous version) misses and renders.
            let stale = format_etag(seeded.resume_id, seeded.version - 1);
            let preview_200 = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(format!("/r/{}/preview.png", seeded.slug))
                        .header(header::IF_NONE_MATCH, &stale)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(preview_200.status(), StatusCode::OK);
            assert_eq!(
                preview_200.headers().get(header::CONTENT_TYPE).unwrap(),
                "image/png"
            );

            // Cloud mode: an unknown path under /r is a server 404, not the SPA shell.
            let not_a_route = app
                .oneshot(
                    Request::builder()
                        .uri("/r/not-a-route/nested/deeper")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(not_a_route.status(), StatusCode::NOT_FOUND);
            let body = body_string(not_a_route).await;
            assert!(
                body.contains("Route not found"),
                "expected JSON 404, got {body}"
            );

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn self_hosted_r_paths_fall_through_to_the_spa_shell() {
            let static_dir = temp_static_dir();
            let app = crate::app::create_router_with_static_dir(static_dir.path().to_path_buf());

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/r/anything")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
            let body = body_string(response).await;
            assert!(body.contains("<title>Rustume</title>"));
        }

        #[tokio::test]
        async fn robots_txt_prefers_a_bundled_file() {
            let static_dir = temp_static_dir();
            std::fs::write(
                static_dir.path().join("robots.txt"),
                "User-agent: *\nDisallow: /\n",
            )
            .expect("write robots.txt");
            let app = crate::app::create_router_with_static_dir(static_dir.path().to_path_buf());

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/robots.txt")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
            let body = body_string(response).await;
            assert_eq!(body, "User-agent: *\nDisallow: /\n");
        }

        #[tokio::test]
        async fn public_page_fails_closed_without_leaking_internals() {
            let Some(url) = database_url_for_tests() else {
                return;
            };
            let pool = connect_test_pool(&url).await;
            let seeded = seed_resume(&pool, true).await;

            // index.html without </head>: 500 with a generic message.
            let no_head = tempfile::tempdir().expect("temp dir");
            std::fs::write(
                no_head.path().join("index.html"),
                "<html><body></body></html>",
            )
            .expect("write index");
            let state = test_app_state(pool.clone(), no_head.path().to_path_buf());
            let err = public_resume_page(State(state), Path(seeded.slug.clone()))
                .await
                .expect_err("missing </head> is an error");
            assert!(matches!(err.kind, ApiErrorKind::InternalError));

            // Missing index.html entirely.
            let empty = tempfile::tempdir().expect("temp dir");
            let state = test_app_state(pool.clone(), empty.path().to_path_buf());
            let err = public_resume_page(State(state), Path(seeded.slug.clone()))
                .await
                .expect_err("unreadable index is an error");
            assert!(matches!(err.kind, ApiErrorKind::InternalError));
            let body = serde_json::to_string(&err).unwrap_or_default();
            assert!(
                !body.contains("index.html") && !body.contains(empty.path().to_str().unwrap()),
                "filesystem details must not leak: {body}"
            );

            // Row whose data is not a ResumeData document.
            sqlx::query("UPDATE resumes SET data = '\"not a resume\"'::jsonb WHERE id = $1")
                .bind(seeded.resume_id)
                .execute(&pool)
                .await
                .expect("corrupt data");
            let static_dir = temp_static_dir();
            let state = test_app_state(pool.clone(), static_dir.path().to_path_buf());
            let err = public_resume_page(State(state.clone()), Path(seeded.slug.clone()))
                .await
                .expect_err("invalid resume data is an error");
            assert!(matches!(err.kind, ApiErrorKind::InternalError));
            let err =
                public_resume_preview(State(state), Path(seeded.slug.clone()), HeaderMap::new())
                    .await
                    .expect_err("invalid resume data is an error for preview too");
            assert!(matches!(err.kind, ApiErrorKind::InternalError));
            let body = serde_json::to_string(&err).unwrap_or_default();
            assert!(
                !body.contains("not a resume"),
                "raw document must not leak: {body}"
            );

            cleanup_user(&pool, seeded.user_id).await;
        }

        #[tokio::test]
        async fn robots_txt_allows_public_pages_and_blocks_api() {
            let static_dir = temp_static_dir();
            let app = crate::app::create_router_with_static_dir(static_dir.path().to_path_buf());

            let response = app
                .oneshot(
                    Request::builder()
                        .uri("/robots.txt")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
            let body = body_string(response).await;
            assert!(body.contains("Allow: /r/"));
            assert!(body.contains("Disallow: /api/"));
        }
    }
}
