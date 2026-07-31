//! Rustume HTTP API Server
//!
//! A REST API for resume parsing, rendering, and validation.
//!
//! # Endpoints
//!
//! - `GET /health` - Health check
//! - `GET /version` - Running build's version, commit, and build time
//! - `GET /api/templates` - List available templates
//! - `POST /api/parse` - Parse resume from various formats
//! - `POST /api/render/pdf` - Render resume to PDF
//! - `POST /api/render/preview` - Render resume to PNG preview
//! - `POST /api/validate` - Validate resume data
//! - `GET /swagger-ui` - Swagger UI documentation
//!
//! # Cloud endpoints (when `RUSTUME_CLOUD=true`)
//!
//! - `GET /auth/login` - Redirect to WorkOS AuthKit
//! - `GET /auth/callback` - OAuth callback
//! - `POST /auth/logout` - Clear session
//! - `GET /auth/me` - Current user profile
//! - `GET/POST /api/resumes` - List and create resumes
//! - `GET/PUT/DELETE /api/resumes/{id}` - Resume CRUD
//! - `POST /api/resumes/import` - Bulk import from local storage
//! - `GET /api/resumes/export` - Bulk JSON export
//! - `GET /api/resumes/export/pdf` - Bulk PDF export (ZIP)
//! - `DELETE /api/account` - Permanently delete account and all data
//! - `GET /metrics` - Prometheus metrics

pub mod app;
pub mod audit;
pub mod auth;
pub mod cloud;
pub mod config;
pub mod db;
pub mod dto;
pub mod email;
pub mod error;
pub mod middleware;
pub mod net;
pub mod observability;
pub mod openapi;
pub mod policy;
pub mod routes;
pub mod run;
pub mod shutdown;
pub mod state;
pub mod subscription;
pub mod validation;

pub use app::{create_router, create_router_with_state, create_router_with_static_dir};
pub use run::run;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use cloud::test_cloud_state;
    use dto::{
        ParseFormat, ParseRequest, RenderPdfRequest, RenderPreviewRequest, TemplateInfo,
        ValidationResponse,
    };
    use error::ApiError;
    use routes::sanitize_static_path;
    use routes::version::VersionResponse;
    use rustume_schema::ResumeData;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_health() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_version() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/version")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/json"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: VersionResponse = serde_json::from_slice(&body).unwrap();

        assert_eq!(payload.version, env!("CARGO_PKG_VERSION"));
    }

    /// A test build carries no Docker build args, so the endpoint must still
    /// answer — reporting `null` for the metadata it does not have.
    #[tokio::test]
    async fn test_version_without_build_metadata_reports_null() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/version")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&body).unwrap();

        // Both keys are always present; a build without metadata reports null
        // rather than an empty string, and never panics for lacking it.
        assert!(payload.get("commit").is_some());
        assert!(payload.get("built_at").is_some());

        if option_env!("RUSTUME_GIT_COMMIT").is_none() {
            assert!(payload["commit"].is_null());
        } else {
            assert!(payload["commit"]
                .as_str()
                .is_some_and(|commit| !commit.is_empty()));
        }

        if option_env!("RUSTUME_BUILD_TIME").is_none() {
            assert!(payload["built_at"].is_null());
        } else {
            assert!(payload["built_at"]
                .as_str()
                .is_some_and(|built_at| !built_at.is_empty()));
        }
    }

    /// Guards route precedence: `/version` must be served by the server route,
    /// not swallowed by the SPA catch-all fallback that serves `index.html`.
    #[tokio::test]
    async fn test_version_is_not_served_by_spa_fallback() {
        let tmp = tempfile::tempdir().unwrap();
        let spa_marker = "<html><body>rustume-spa-fallback</body></html>";
        std::fs::write(tmp.path().join("index.html"), spa_marker).unwrap();
        let app = create_router_with_static_dir(tmp.path().to_path_buf());

        // Sanity-check the fixture: an unknown path *does* get the SPA shell.
        let fallback = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/some-client-route")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let fallback_body = axum::body::to_bytes(fallback.into_body(), usize::MAX)
            .await
            .unwrap();
        assert_eq!(std::str::from_utf8(&fallback_body).unwrap(), spa_marker);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/version")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/json"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = std::str::from_utf8(&body).unwrap();

        assert!(!text.contains("rustume-spa-fallback"));
        assert!(!text.contains("<html"));

        let payload: VersionResponse = serde_json::from_str(text).unwrap();
        assert_eq!(payload.version, env!("CARGO_PKG_VERSION"));
    }

    #[tokio::test]
    async fn test_templates() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let templates: Vec<TemplateInfo> = serde_json::from_slice(&body).unwrap();

        assert!(!templates.is_empty());
        assert!(templates.iter().any(|t| t.id == "rhyhorn"));
    }

    #[tokio::test]
    async fn test_validate_valid() {
        let app = create_router();
        let resume = ResumeData::default();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&resume).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(result.valid);
        assert!(result.errors.is_none());
    }

    #[tokio::test]
    async fn test_validate_unknown_shape() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"foo":1}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(
            !result.valid,
            "Unknown JSON shape must not return valid:true"
        );
        assert!(result.errors.is_some());
    }

    #[tokio::test]
    async fn test_validate_malformed_body_returns_bad_request() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"basics":"not-an-object"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_validate_partial_resume_still_valid() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"basics":{"name":"Ada Lovelace","email":"ada@example.com"}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(result.valid);
        assert!(result.errors.is_none());
    }

    #[tokio::test]
    async fn test_parse_json_resume() {
        let app = create_router();

        let json_resume = r#"{
            "basics": {
                "name": "Test User",
                "label": "Developer",
                "email": "test@example.com"
            }
        }"#;

        let request = ParseRequest {
            format: ParseFormat::JsonResume,
            data: json_resume.to_string(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let resume: ResumeData = serde_json::from_slice(&body).unwrap();

        assert_eq!(resume.basics.name, "Test User");
        assert_eq!(resume.basics.headline, "Developer");
    }

    #[tokio::test]
    async fn test_render_pdf() {
        let app = create_router();

        let request = RenderPdfRequest {
            resume: serde_json::to_value(ResumeData::default()).unwrap(),
            template: None,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/pdf")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/pdf"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        // Check PDF magic bytes
        assert!(body.starts_with(b"%PDF"));
    }

    #[tokio::test]
    async fn test_render_preview() {
        let app = create_router();

        let request = RenderPreviewRequest {
            resume: serde_json::to_value(ResumeData::default()).unwrap(),
            template: None,
            page: 0,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/preview")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers().get("content-type").unwrap(), "image/png");
        assert!(response.headers().contains_key("x-total-pages"));

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        // Check PNG magic bytes
        assert!(body.starts_with(&[0x89, 0x50, 0x4E, 0x47]));
    }

    #[tokio::test]
    async fn test_swagger_ui() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/swagger-ui/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_unknown_api_route_returns_not_found() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/missing")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_asset_miss_returns_404() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("index.html"), "<html></html>").unwrap();
        let app = create_router_with_static_dir(tmp.path().to_path_buf());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/assets/missing.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_post_to_unmatched_route_returns_method_not_allowed() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/some-unmatched-path")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[test]
    fn test_static_path_rejects_traversal() {
        assert!(sanitize_static_path("/assets/app.js").is_some());
        assert!(sanitize_static_path("/../Cargo.toml").is_none());
        assert!(sanitize_static_path("/assets/../Cargo.toml").is_none());
    }

    #[tokio::test]
    async fn test_openapi_spec() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api-docs/openapi.json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(spec["info"]["title"], "Rustume API");
        assert_eq!(spec["info"]["version"], env!("CARGO_PKG_VERSION"));
        assert!(spec["paths"].as_object().unwrap().contains_key("/health"));
        assert!(spec["paths"].as_object().unwrap().contains_key("/version"));
        assert!(spec["paths"]
            .as_object()
            .unwrap()
            .contains_key("/api/templates"));
        assert!(spec["paths"].as_object().unwrap().contains_key("/auth/me"));
        assert!(spec["paths"]
            .as_object()
            .unwrap()
            .contains_key("/api/resumes"));
        assert!(spec["components"]["securitySchemes"]["cookieAuth"].is_object());
    }

    #[tokio::test]
    async fn test_parse_rustume_format() {
        let app = create_router();
        let resume = ResumeData::default();

        let request = ParseRequest {
            format: ParseFormat::Rustume,
            data: serde_json::to_string(&resume).unwrap(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: ResumeData = serde_json::from_slice(&body).unwrap();

        assert_eq!(parsed.basics.name, resume.basics.name);
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let app = create_router();

        let request = ParseRequest {
            format: ParseFormat::JsonResume,
            data: "{ invalid json }".to_string(),
            base64: false,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/parse")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&request).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let error: ApiError = serde_json::from_slice(&body).unwrap();

        assert!(error.error.contains("Failed to parse"));
    }

    #[tokio::test]
    async fn test_validate_invalid_email() {
        let app = create_router();
        let mut resume = ResumeData::default();
        resume.basics.email = "invalid-email".to_string();

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&resume).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let result: ValidationResponse = serde_json::from_slice(&body).unwrap();

        assert!(
            !result.valid,
            "Expected validation to fail for invalid email"
        );
        assert!(result.errors.is_some(), "Expected errors to be present");
        let errors = result.errors.unwrap();
        // Just verify we got some validation errors - the exact format depends on validator internals
        assert!(
            !errors.is_empty(),
            "Expected at least one error, got: {:?}",
            errors
        );
    }

    #[tokio::test]
    async fn test_body_size_limit() {
        let app = create_router();

        // Create a payload larger than MAX_BODY_SIZE (10 MB)
        let large_payload = vec![b'x'; 11 * 1024 * 1024];

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/validate")
                    .header("content-type", "application/json")
                    .body(Body::from(large_payload))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should be rejected with 413 Payload Too Large
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }

    #[tokio::test]
    async fn test_templates_returns_expected_count() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let templates: Vec<TemplateInfo> = serde_json::from_slice(&body).unwrap();

        // Should return all 12 templates
        assert_eq!(templates.len(), 12);
        assert!(templates.iter().any(|t| t.id == "rhyhorn"));
        assert!(templates.iter().any(|t| t.id == "azurill"));
        assert!(templates.iter().any(|t| t.id == "pikachu"));
        assert!(templates.iter().any(|t| t.id == "nosepass"));
        assert!(templates.iter().any(|t| t.id == "bronzor"));
        assert!(templates.iter().any(|t| t.id == "chikorita"));
        assert!(templates.iter().any(|t| t.id == "ditto"));
        assert!(templates.iter().any(|t| t.id == "gengar"));
        assert!(templates.iter().any(|t| t.id == "glalie"));
        assert!(templates.iter().any(|t| t.id == "kakuna"));
        assert!(templates.iter().any(|t| t.id == "leafish"));
        assert!(templates.iter().any(|t| t.id == "onyx"));
    }

    #[tokio::test]
    async fn test_templates_expose_layout_metadata() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let templates: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();

        assert_eq!(templates.len(), 12);
        for template in &templates {
            let id = template["id"].as_str().unwrap();
            let layout = &template["layout"];
            assert!(layout.is_object(), "{id} is missing layout");
            assert!(
                layout["layoutMode"].as_str().is_some_and(|m| !m.is_empty()),
                "{id} is missing layoutMode"
            );
            assert!(
                layout["headerStyle"]
                    .as_str()
                    .is_some_and(|h| !h.is_empty()),
                "{id} is missing headerStyle"
            );
            assert!(
                layout["contactIn"].as_str().is_some_and(|c| !c.is_empty()),
                "{id} is missing contactIn"
            );
            assert!(layout.get("sidebarWidth").is_some(), "{id} sidebarWidth");

            let columns = layout["defaultColumns"].as_array().unwrap();
            assert_eq!(columns.len(), 2, "{id} should expose two columns");
            assert!(
                !columns[0].as_array().unwrap().is_empty(),
                "{id} has an empty main column"
            );
        }

        let pikachu = templates.iter().find(|t| t["id"] == "pikachu").unwrap();
        assert_eq!(pikachu["layout"]["layoutMode"], "sidebar-left");
        assert_eq!(pikachu["layout"]["contactIn"], "sidebar");
        assert_eq!(pikachu["layout"]["sidebarWidth"], 180);

        let onyx = templates.iter().find(|t| t["id"] == "onyx").unwrap();
        assert_eq!(onyx["layout"]["layoutMode"], "single");
        assert!(onyx["layout"]["defaultColumns"][1]
            .as_array()
            .unwrap()
            .is_empty());
        assert!(onyx["layout"]["sidebarWidth"].is_null());
    }

    #[tokio::test]
    async fn test_health_returns_json_compatible() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = std::str::from_utf8(&body).unwrap();

        assert_eq!(text, "ok");
    }

    #[tokio::test]
    async fn test_template_thumbnail() {
        let app = create_router();

        let ok = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/templates/rhyhorn/thumbnail")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(ok.status(), StatusCode::OK);
        assert_eq!(ok.headers().get("content-type").unwrap(), "image/png");

        let missing = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates/not-a-template/thumbnail")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(missing.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn test_security_txt_endpoint() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/.well-known/security.txt")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "text/plain; charset=utf-8"
        );

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let text = std::str::from_utf8(&body).unwrap();
        assert!(text.contains("Contact: mailto:turbocoder13@gmail.com"));
        assert!(text.contains("Canonical: https://rustume.com/.well-known/security.txt"));
    }

    #[tokio::test]
    async fn test_render_rejects_deeply_nested_resume_json() {
        use crate::config::MAX_JSON_DEPTH;

        let app = create_router();
        let mut resume = serde_json::json!(1);
        for _ in 0..MAX_JSON_DEPTH {
            resume = serde_json::json!({ "nested": resume });
        }

        let payload = serde_json::json!({ "resume": resume });
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/preview")
                    .header("content-type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_security_headers() {
        let app = create_router();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.headers().get("x-content-type-options").unwrap(),
            "nosniff"
        );
        assert_eq!(response.headers().get("x-frame-options").unwrap(), "DENY");
        assert_eq!(response.headers().get("x-xss-protection").unwrap(), "0");
        assert_eq!(
            response.headers().get("referrer-policy").unwrap(),
            "strict-origin-when-cross-origin"
        );
    }

    fn sample_render_pdf_request() -> RenderPdfRequest {
        RenderPdfRequest {
            resume: serde_json::to_value(ResumeData::default()).unwrap(),
            template: None,
        }
    }

    /// Cloud mode gates billable routes on cloud presence, not on a flag, so a
    /// state that advertises `require_auth: false` still rejects anonymous
    /// requests. This pins the removal of `RUSTUME_REQUIRE_AUTH`: no
    /// configuration can re-open a cloud deployment.
    #[tokio::test]
    async fn test_render_pdf_anonymous_401_on_cloud_even_when_flag_is_off() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            false,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/pdf")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&sample_render_pdf_request()).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    // Self-hosted deployments have no accounts and stay open anonymously:
    // covered by `test_render_pdf` and `test_templates`, which build a
    // `create_router()` (cloud-less) app and assert 200.

    #[tokio::test]
    async fn test_render_pdf_anonymous_401_on_cloud() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/render/pdf")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&sample_render_pdf_request()).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_templates_anonymous_401_on_cloud() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/templates")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_resumes_anonymous_401_on_cloud() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/resumes")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_me_includes_require_auth_when_signed_out() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/auth/me")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: db::AuthMeUnauthorizedResponse = serde_json::from_slice(&body).unwrap();
        assert!(payload.require_auth);
        assert_eq!(payload.error, "Not authenticated");
    }

    #[tokio::test]
    async fn test_self_hosted_health_has_no_rate_limit() {
        let app = create_router();
        let default_health_quota = config::RateLimitConfig::default().health_per_min;
        let request_count = default_health_quota as usize + 1;

        for _ in 0..request_count {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/health")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn test_self_hosted_version_has_no_rate_limit() {
        let app = create_router();
        let default_health_quota = config::RateLimitConfig::default().health_per_min;
        let request_count = default_health_quota as usize + 1;

        for _ in 0..request_count {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/version")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn test_cloud_auth_rate_limit_returns_429() {
        let config = config::RateLimitConfig {
            auth_per_min: 2,
            ..Default::default()
        };

        let state = state::AppState::with_options(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            false,
            config,
        );
        let app = create_router_with_state(state);

        for _ in 0..2 {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/auth/login")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
        }

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/auth/login")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(
            response.headers().get("X-RateLimit-Remaining").unwrap(),
            "0"
        );
        assert!(response
            .headers()
            .get("Retry-After")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok())
            .is_some_and(|retry_after| retry_after >= 1));
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        assert!(response
            .headers()
            .get("X-RateLimit-Reset")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok())
            .is_some_and(|reset| reset >= now));

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let payload: middleware::rate_limit::RateLimitErrorBody =
            serde_json::from_slice(&body).unwrap();
        assert!(payload.retry_after >= 1);
        assert!(payload.error.contains("Too many requests"));
    }

    #[tokio::test]
    async fn test_delete_account_unauthenticated_401() {
        let state = state::AppState::with_require_auth(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
        );
        let app = create_router_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri("/api/account")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"confirmation":"DELETE"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_delete_account_unauthenticated_not_rate_limited() {
        let config = config::RateLimitConfig {
            account_delete_per_min: 2,
            ..Default::default()
        };

        let state = state::AppState::with_options(
            std::sync::Arc::new(routes::static_dir()),
            Some(test_cloud_state()),
            true,
            config,
        );
        let app = create_router_with_state(state);
        let body = r#"{"confirmation":"DELETE"}"#;

        for _ in 0..5 {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("DELETE")
                        .uri("/api/account")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
    }
}
