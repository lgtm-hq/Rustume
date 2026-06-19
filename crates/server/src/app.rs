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
    rate_limit_pdf, rate_limit_preview, rate_limit_resume_crud,
};
use crate::middleware::security::security_headers;
use crate::observability::apply_sentry_layers;
use crate::openapi::ApiDoc;
use crate::routes::{
    callback, create_resume, delete_account, delete_resume, get_resume, health, import_resumes,
    list_resumes, list_templates, login, logout, me, metrics, parse, render_pdf, render_preview,
    security_txt, spa_fallback, static_dir, template_thumbnail, update_resume, validate,
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

        router = router
            .merge(auth_routes)
            .merge(resume_routes)
            .merge(import_routes)
            .merge(account_routes);
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

    match std::env::var("CORS_ORIGIN").ok() {
        Some(origin) if !origin.is_empty() && origin != "*" => {
            let origins: Vec<HeaderValue> = origin
                .split(',')
                .filter_map(|o| o.trim().parse().ok())
                .collect();
            base.allow_origin(origins).allow_credentials(true)
        }
        _ => base.allow_origin(Any),
    }
}
