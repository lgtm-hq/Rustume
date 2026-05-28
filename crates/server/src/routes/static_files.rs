use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use std::path::{Component, Path as FsPath, PathBuf};

use crate::config::DEFAULT_STATIC_DIR;
use crate::error::ApiError;
use crate::state::AppState;

pub fn static_dir() -> PathBuf {
    std::env::var("RUSTUME_STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(DEFAULT_STATIC_DIR))
}

fn is_reserved_server_path(path: &str) -> bool {
    path == "/api"
        || path.starts_with("/api/")
        || path == "/api-docs"
        || path.starts_with("/api-docs/")
        || path == "/swagger-ui"
        || path.starts_with("/swagger-ui/")
        || path == "/health"
        || path == "/metrics"
        || path.starts_with("/auth/")
        || path == "/auth"
}

pub fn sanitize_static_path(path: &str) -> Option<PathBuf> {
    let relative = path.trim_start_matches('/');
    let relative = if relative.is_empty() {
        "index.html"
    } else {
        relative
    };

    let mut safe = PathBuf::new();
    for component in FsPath::new(relative).components() {
        match component {
            Component::Normal(part) => safe.push(part),
            _ => return None,
        }
    }

    Some(safe)
}

fn content_type(path: &FsPath) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("css") => "text/css; charset=utf-8",
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("wasm") => "application/wasm",
        Some("webmanifest") => "application/manifest+json; charset=utf-8",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn cache_control(path: &FsPath) -> &'static str {
    if path.starts_with("assets") {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    }
}

async fn serve_static_file(path: &FsPath, relative: &FsPath) -> Option<Response> {
    match tokio::fs::read(path).await {
        Ok(body) => Response::builder()
            .header(axum::http::header::CONTENT_TYPE, content_type(path))
            .header(axum::http::header::CACHE_CONTROL, cache_control(relative))
            .body(axum::body::Body::from(body))
            .ok(),
        Err(_) => None,
    }
}

pub async fn spa_fallback(
    State(state): State<AppState>,
    method: axum::http::Method,
    uri: axum::http::Uri,
) -> Response {
    let path = uri.path();
    if is_reserved_server_path(path) {
        return ApiError::not_found("Route not found").into_response();
    }

    if method != axum::http::Method::GET && method != axum::http::Method::HEAD {
        return (StatusCode::METHOD_NOT_ALLOWED, "Method not allowed").into_response();
    }

    let Some(relative_path) = sanitize_static_path(path) else {
        return ApiError::not_found("Route not found").into_response();
    };

    let root = state.static_dir.as_path();
    let asset_path = root.join(&relative_path);

    if let (Ok(canonical_root), Ok(canonical_asset)) = (
        tokio::fs::canonicalize(root).await,
        tokio::fs::canonicalize(&asset_path).await,
    ) {
        if !canonical_asset.starts_with(&canonical_root) {
            return ApiError::not_found("Route not found").into_response();
        }
        if let Some(response) = serve_static_file(&canonical_asset, &relative_path).await {
            return response;
        }
    } else if asset_path.extension().is_some() {
        return (StatusCode::NOT_FOUND, "Not Found").into_response();
    }

    let index_path = root.join("index.html");
    let index_relative = PathBuf::from("index.html");
    serve_static_file(&index_path, &index_relative)
        .await
        .unwrap_or_else(|| {
            ApiError::not_found(format!("Web UI assets not found in {}", root.display()))
                .into_response()
        })
}
