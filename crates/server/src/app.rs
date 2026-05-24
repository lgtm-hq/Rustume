use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderValue, Method},
    middleware,
    routing::{get, post},
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
use crate::middleware::security::security_headers;
use crate::observability::apply_sentry_layers;
use crate::openapi::ApiDoc;
use crate::routes::{
    callback, create_resume, delete_resume, get_resume, health, import_resumes, list_resumes,
    list_templates, login, logout, me, metrics, parse, render_pdf, render_preview, spa_fallback,
    static_dir, template_thumbnail, update_resume, validate,
};
use crate::state::AppState;

pub fn create_router() -> Router {
    create_router_with_state(AppState {
        static_dir: Arc::new(static_dir()),
        cloud: None,
    })
}

pub fn create_router_with_static_dir(dir: PathBuf) -> Router {
    create_router_with_state(AppState {
        static_dir: Arc::new(dir),
        cloud: None,
    })
}

pub fn create_router_with_state(state: AppState) -> Router {
    let cors = build_cors_layer();

    let mut router = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .route("/api/templates", get(list_templates))
        .route("/api/templates/{id}/thumbnail", get(template_thumbnail))
        .route("/api/parse", post(parse))
        .route("/api/render/pdf", post(render_pdf))
        .route("/api/render/preview", post(render_preview))
        .route("/api/validate", post(validate))
        .fallback(spa_fallback);

    if state.cloud.is_some() {
        router = router
            .route("/auth/login", get(login))
            .route("/auth/callback", get(callback))
            .route("/auth/logout", post(logout))
            .route("/auth/me", get(me))
            .route("/api/resumes", get(list_resumes).post(create_resume))
            .route("/api/resumes/import", post(import_resumes))
            .route(
                "/api/resumes/{id}",
                get(get_resume).put(update_resume).delete(delete_resume),
            );
    }

    let router = router
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
        .expose_headers(["X-Total-Pages".parse::<header::HeaderName>().unwrap()]);

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
