use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderValue, Method},
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::config::MAX_BODY_SIZE;
use crate::middleware::auth::require_auth_when_enabled;
use crate::middleware::rate_limit::{
    rate_limit_auth, rate_limit_billable, rate_limit_health, rate_limit_import, rate_limit_metrics,
    rate_limit_pdf, rate_limit_preview, rate_limit_resume_crud, rate_limit_unauthenticated,
};
use crate::middleware::security::security_headers;
use crate::middleware::subscription::require_subscription_render;
use crate::observability::apply_sentry_layers;
use crate::openapi::ApiDoc;
use crate::routes::{
    callback, create_resume, delete_account, delete_resume, export_resumes_json,
    export_resumes_pdf, get_resume, health, import_resumes, list_resumes, list_templates, login,
    logout, me, metrics, parse, public_resume_data, public_resume_page, public_resume_preview,
    render_pdf, render_preview, robots_txt, security_txt, spa_fallback, static_dir,
    template_thumbnail, update_resume, validate,
};
use crate::state::AppState;

/// Build the default router in self-hosted (stateless) mode.
pub fn create_router() -> Router {
    create_router_with_state(AppState::new(Arc::new(static_dir()), None))
}

/// Build a router with a custom static asset directory (used in tests).
pub fn create_router_with_static_dir(dir: PathBuf) -> Router {
    create_router_with_state(AppState::new(Arc::new(dir), None))
}

/// Build the full Axum router, registering cloud routes when `state.cloud` is set.
pub fn create_router_with_state(state: AppState) -> Router {
    let cors = build_cors_layer();
    let cloud_rate_limits = state.rate_limits.is_some();
    let state_for_layers = state.clone();

    let mut billable_core = Router::new()
        .route("/api/templates", get(list_templates))
        .route("/api/templates/{id}/thumbnail", get(template_thumbnail))
        .route("/api/parse", post(parse))
        .route("/api/validate", post(validate))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_auth_when_enabled,
        ));
    if cloud_rate_limits {
        billable_core = billable_core.route_layer(middleware::from_fn_with_state(
            state_for_layers.clone(),
            rate_limit_billable,
        ));
    }

    let mut preview_routes = Router::new()
        .route("/api/render/preview", post(render_preview))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_auth_when_enabled,
        ));
    if cloud_rate_limits {
        preview_routes = preview_routes.route_layer(middleware::from_fn_with_state(
            state_for_layers.clone(),
            rate_limit_preview,
        ));
    }
    if state.cloud.is_some() {
        preview_routes = preview_routes.route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_subscription_render,
        ));
    }

    let mut pdf_routes = Router::new()
        .route("/api/render/pdf", post(render_pdf))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_auth_when_enabled,
        ));
    if cloud_rate_limits {
        pdf_routes = pdf_routes.route_layer(middleware::from_fn_with_state(
            state_for_layers.clone(),
            rate_limit_pdf,
        ));
    }
    if state.cloud.is_some() {
        pdf_routes = pdf_routes.route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_subscription_render,
        ));
    }

    let mut health_routes = Router::new().route("/health", get(health));
    if cloud_rate_limits {
        health_routes = health_routes.route_layer(middleware::from_fn_with_state(
            state_for_layers.clone(),
            rate_limit_health,
        ));
    }

    let mut metrics_routes = Router::new().route("/metrics", get(metrics));
    if cloud_rate_limits {
        metrics_routes = metrics_routes.route_layer(middleware::from_fn_with_state(
            state_for_layers.clone(),
            rate_limit_metrics,
        ));
    }

    let mut router = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/.well-known/security.txt", get(security_txt))
        .route("/robots.txt", get(robots_txt))
        .merge(health_routes)
        .merge(metrics_routes)
        .merge(billable_core)
        .merge(preview_routes)
        .merge(pdf_routes);

    if state.cloud.is_some() {
        let auth_routes = Router::new()
            .route("/auth/login", get(login))
            .route("/auth/callback", get(callback))
            .route("/auth/logout", post(logout))
            .route("/auth/me", get(me))
            .route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_auth,
            ));

        let mut resume_routes = Router::new()
            .route("/api/resumes", get(list_resumes).post(create_resume))
            .route(
                "/api/resumes/{id}",
                get(get_resume).put(update_resume).delete(delete_resume),
            )
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_auth_when_enabled,
            ));
        if cloud_rate_limits {
            resume_routes = resume_routes.route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_resume_crud,
            ));
        }

        let mut import_routes = Router::new()
            .route("/api/resumes/import", post(import_resumes))
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_auth_when_enabled,
            ));
        if cloud_rate_limits {
            import_routes = import_routes.route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_import,
            ));
        }

        let account_routes = Router::new()
            .route("/api/account", delete(delete_account))
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_auth_when_enabled,
            ));

        let mut export_json_routes = Router::new()
            .route("/api/resumes/export", get(export_resumes_json))
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_auth_when_enabled,
            ));
        if cloud_rate_limits {
            export_json_routes = export_json_routes.route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_resume_crud,
            ));
        }

        let mut export_pdf_routes = Router::new()
            .route("/api/resumes/export/pdf", get(export_resumes_pdf))
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                require_auth_when_enabled,
            ));
        if cloud_rate_limits {
            export_pdf_routes = export_pdf_routes.route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_pdf,
            ));
        }

        let mut public_routes = Router::new()
            .route("/r/{slug}/preview.png", get(public_resume_preview))
            .route("/r/{slug}/data", get(public_resume_data))
            .route("/r/{slug}", get(public_resume_page));
        if cloud_rate_limits {
            public_routes = public_routes.route_layer(middleware::from_fn_with_state(
                state_for_layers.clone(),
                rate_limit_unauthenticated,
            ));
        }

        router = router
            .merge(auth_routes)
            .merge(resume_routes)
            .merge(import_routes)
            .merge(export_json_routes)
            .merge(export_pdf_routes)
            .merge(account_routes)
            .merge(public_routes);
    }

    let router = router
        .fallback(spa_fallback)
        .with_state(state)
        .layer(middleware::from_fn(security_headers))
        .layer(CompressionLayer::new())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(MAX_BODY_SIZE));

    apply_sentry_layers(router)
}

fn build_cors_layer() -> CorsLayer {
    build_cors_layer_for_origin(std::env::var("CORS_ORIGIN").ok())
}

fn build_cors_layer_for_origin(origin: Option<String>) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::COOKIE,
            header::AUTHORIZATION,
        ])
        .expose_headers([
            "X-Total-Pages".parse::<header::HeaderName>().unwrap(),
            "Retry-After".parse::<header::HeaderName>().unwrap(),
            "X-RateLimit-Remaining"
                .parse::<header::HeaderName>()
                .unwrap(),
            "X-RateLimit-Reset".parse::<header::HeaderName>().unwrap(),
        ]);

    match origin.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }) {
        Some(origin) if origin == "*" => base.allow_origin(Any),
        Some(origin) => {
            let parts: Vec<&str> = origin
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect();
            let had_entries = !parts.is_empty();
            let mut origins = Vec::with_capacity(parts.len());
            for part in parts {
                match part.parse::<HeaderValue>() {
                    Ok(value) => origins.push(value),
                    Err(error) => tracing::warn!(
                        origin = part,
                        error = %error,
                        "Invalid CORS_ORIGIN entry; skipping"
                    ),
                }
            }
            if origins.is_empty() {
                if had_entries {
                    tracing::warn!(
                        cors_origin = %origin,
                        "CORS_ORIGIN contained no valid origins; cross-origin requests will be denied"
                    );
                }
                base
            } else {
                base.allow_origin(origins).allow_credentials(true)
            }
        }
        None => base,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, routing::get, Router};
    use tower::ServiceExt;

    async fn cors_preflight(cors: CorsLayer, origin: &str) -> axum::http::Response<Body> {
        let app = Router::new()
            .route("/test", get(|| async { "ok" }))
            .layer(cors);

        app.oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/test")
                .header("origin", origin)
                .header("access-control-request-method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn cors_unset_rejects_cross_origin() {
        let response =
            cors_preflight(build_cors_layer_for_origin(None), "https://evil.example").await;

        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-origin"),
            "unset CORS_ORIGIN must not allow arbitrary cross-origin access"
        );
    }

    #[tokio::test]
    async fn cors_empty_rejects_cross_origin() {
        let response = cors_preflight(
            build_cors_layer_for_origin(Some(String::new())),
            "https://evil.example",
        )
        .await;

        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-origin"),
            "empty CORS_ORIGIN must not allow arbitrary cross-origin access"
        );
    }

    #[tokio::test]
    async fn cors_wildcard_allows_cross_origin() {
        let response = cors_preflight(
            build_cors_layer_for_origin(Some("*".to_string())),
            "https://evil.example",
        )
        .await;

        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "*"
        );
    }

    #[tokio::test]
    async fn cors_specific_origin_allows_matching_origin() {
        let response = cors_preflight(
            build_cors_layer_for_origin(Some("http://localhost:3000".to_string())),
            "http://localhost:3000",
        )
        .await;

        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "http://localhost:3000"
        );
    }

    #[tokio::test]
    async fn cors_invalid_origin_rejects_cross_origin() {
        let response = cors_preflight(
            build_cors_layer_for_origin(Some("not-a-valid-origin".to_string())),
            "https://evil.example",
        )
        .await;

        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-origin"),
            "invalid CORS_ORIGIN must not allow cross-origin access"
        );
    }
}
