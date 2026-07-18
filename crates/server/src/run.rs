use anyhow::Context;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, warn};

use crate::app::create_router_with_state;
use crate::cloud::{cloud_enabled, init_cloud, CloudConfig};
use crate::config::DEFAULT_PORT;
use crate::middleware::rate_limit::RateLimitState;
use crate::observability::init_sentry;
use crate::routes::{init_metrics, static_dir};
use crate::shutdown::{health_probe, shutdown_signal};
use crate::state::AppState;
use crate::storage::{init_storage, seed_local_user, StorageConfig};

/// Start the HTTP server: always initialize storage when `DATABASE_URL` is
/// set, and layer Rustume Cloud auth on top when `RUSTUME_CLOUD` is enabled.
pub async fn run() -> anyhow::Result<()> {
    if std::env::args().any(|a| a == "--health") {
        std::process::exit(health_probe());
    }

    let _sentry_guard = init_sentry();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .init();

    init_metrics();

    let static_root = Arc::new(static_dir());
    let cloud_mode = cloud_enabled();

    let storage = match StorageConfig::from_env(cloud_mode)? {
        Some(config) => Some(init_storage(config).await?),
        None => {
            if crate::cloud::cloud_flag_enabled() {
                anyhow::bail!("DATABASE_URL must be set when RUSTUME_CLOUD is enabled");
            }
            warn!(
                "DATABASE_URL is not set — running in stateless fallback mode; resume data \
                 stays in the browser and is not persisted server-side"
            );
            None
        }
    };

    let cloud = match (&storage, cloud_mode) {
        (Some(storage), true) => {
            let config = CloudConfig::from_env()?;
            info!("Rustume Cloud mode enabled");
            Some(init_cloud(config, storage.db.clone())?)
        }
        (Some(storage), false) => {
            seed_local_user(&storage.db).await?;
            info!("Running in self-hosted mode with persistent server-side storage");
            None
        }
        (None, _) => None,
    };

    let app_state = AppState::new(static_root.clone(), storage, cloud);
    if let Some(rate_limits) = app_state.rate_limits.clone() {
        RateLimitState::spawn_eviction_task(rate_limits);
    }
    let app = create_router_with_state(app_state);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Starting Rustume API server on http://{}", addr);
    info!(
        "Swagger UI available at http://{}:{}/swagger-ui",
        addr.ip(),
        port
    );
    info!(
        "Serving web UI assets from {} (set RUSTUME_STATIC_DIR to override)",
        static_root.as_path().display()
    );
    info!(
        "CORS origin: {}",
        std::env::var("CORS_ORIGIN").unwrap_or_else(|_| "(same-origin only)".to_string())
    );

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context(format!("Failed to bind to {}", addr))?;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Server error")?;

    info!("Server stopped");
    Ok(())
}
