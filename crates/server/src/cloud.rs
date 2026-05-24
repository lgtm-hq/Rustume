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
    pub database_url: String,
    pub workos_client_id: String,
    pub workos_api_key: String,
    pub workos_redirect_uri: String,
    pub session_secret: String,
}

impl CloudConfig {
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

pub fn cloud_enabled() -> bool {
    matches!(std::env::var("RUSTUME_CLOUD").as_deref(), Ok("true" | "1"))
        && std::env::var("DATABASE_URL").is_ok()
}

/// Shared cloud services (database, auth providers).
#[derive(Clone)]
pub struct CloudState {
    pub db: PgPool,
    pub workos: WorkOsClient,
    pub sessions: SessionService,
}

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
