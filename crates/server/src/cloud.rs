//! Rustume Cloud bootstrap: PostgreSQL pool, WorkOS client, and session service.

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

use crate::auth::session::SessionService;
use crate::auth::workos::WorkOsClient;

/// Cloud-specific configuration loaded from environment variables.
#[derive(Clone, Debug)]
pub struct CloudConfig {
    /// PostgreSQL connection string (`DATABASE_URL`).
    pub database_url: String,
    /// WorkOS AuthKit client ID.
    pub workos_client_id: String,
    /// WorkOS API key (server-side secret).
    pub workos_api_key: String,
    /// OAuth redirect URI registered in WorkOS.
    pub workos_redirect_uri: String,
    /// Secret used to sign session cookies.
    pub session_secret: String,
}

impl CloudConfig {
    /// Load required cloud settings from the process environment.
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: required_env("DATABASE_URL")?,
            workos_client_id: required_env("WORKOS_CLIENT_ID")?,
            workos_api_key: required_env("WORKOS_API_KEY")?,
            workos_redirect_uri: required_env("WORKOS_REDIRECT_URI")?,
            session_secret: required_env("SESSION_SECRET")?,
        })
    }
}

fn required_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Missing required environment variable: {key}"))
}

/// Returns `true` when `RUSTUME_CLOUD` is enabled and `DATABASE_URL` is set.
pub fn cloud_enabled() -> bool {
    matches!(std::env::var("RUSTUME_CLOUD").as_deref(), Ok("true" | "1"))
        && std::env::var("DATABASE_URL").is_ok()
}

/// Shared cloud services (database, auth providers).
#[derive(Clone)]
pub struct CloudState {
    /// PostgreSQL connection pool.
    pub db: PgPool,
    /// WorkOS AuthKit HTTP client.
    pub workos: WorkOsClient,
    /// Session cookie persistence and validation.
    pub sessions: SessionService,
}

/// Connect to PostgreSQL, run migrations, and wire cloud auth services.
pub async fn init_cloud(config: CloudConfig) -> anyhow::Result<Arc<CloudState>> {
    let db = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./src/db/migrations").run(&db).await?;

    info!("PostgreSQL migrations applied");

    let workos = WorkOsClient::new(config.workos_client_id, config.workos_api_key);
    let sessions = SessionService::new(db.clone(), config.session_secret);

    Ok(Arc::new(CloudState {
        db,
        workos,
        sessions,
    }))
}
