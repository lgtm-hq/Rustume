//! Rustume Cloud bootstrap: PostgreSQL pool, WorkOS client, and session service.

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

use crate::auth::session::SessionService;
use crate::auth::workos::WorkOsClient;

/// Cloud-specific configuration loaded from environment variables.
#[derive(Clone)]
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
    /// Maximum PostgreSQL pool connections (`DB_MAX_CONNECTIONS`, default 10).
    pub db_max_connections: u32,
    /// Pool acquire timeout in seconds (`DB_ACQUIRE_TIMEOUT_SECS`, default 5).
    pub db_acquire_timeout_secs: u64,
}

impl CloudConfig {
    /// Load required cloud settings from the process environment.
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = required_non_empty_env("DATABASE_URL")?;

        let session_secret = required_non_empty_env("SESSION_SECRET")?;
        if session_secret.len() < 32 {
            anyhow::bail!("SESSION_SECRET must be at least 32 characters");
        }

        Ok(Self {
            database_url,
            workos_client_id: required_non_empty_env("WORKOS_CLIENT_ID")?,
            workos_api_key: required_non_empty_env("WORKOS_API_KEY")?,
            workos_redirect_uri: required_non_empty_env("WORKOS_REDIRECT_URI")?,
            session_secret,
            db_max_connections: optional_env_u32("DB_MAX_CONNECTIONS", 10)?,
            db_acquire_timeout_secs: optional_env_u64("DB_ACQUIRE_TIMEOUT_SECS", 5)?,
        })
    }
}

impl std::fmt::Debug for CloudConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CloudConfig")
            .field("database_url", &"<redacted>")
            .field("workos_client_id", &self.workos_client_id)
            .field("workos_api_key", &"<redacted>")
            .field("workos_redirect_uri", &self.workos_redirect_uri)
            .field("session_secret", &"<redacted>")
            .field("db_max_connections", &self.db_max_connections)
            .field("db_acquire_timeout_secs", &self.db_acquire_timeout_secs)
            .finish()
    }
}

fn optional_env<T>(key: &str, default: T) -> anyhow::Result<T>
where
    T: std::str::FromStr,
{
    match std::env::var(key) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                Ok(default)
            } else {
                trimmed
                    .parse::<T>()
                    .map_err(|_| anyhow::anyhow!("failed to parse env var {key}"))
            }
        }
        Err(_) => Ok(default),
    }
}

fn optional_env_u32(key: &str, default: u32) -> anyhow::Result<u32> {
    optional_env(key, default)
}

fn optional_env_u64(key: &str, default: u64) -> anyhow::Result<u64> {
    optional_env(key, default)
}

fn required_env(key: &str) -> anyhow::Result<String> {
    std::env::var(key).map_err(|_| anyhow::anyhow!("Missing required environment variable: {key}"))
}

fn required_non_empty_env(key: &str) -> anyhow::Result<String> {
    let value = required_env(key)?;
    if value.trim().is_empty() {
        anyhow::bail!("{key} must not be empty");
    }
    Ok(value)
}

/// Returns `true` when `RUSTUME_CLOUD` is enabled and `DATABASE_URL` is set.
pub fn cloud_enabled() -> bool {
    matches!(std::env::var("RUSTUME_CLOUD").as_deref(), Ok("true" | "1"))
        && std::env::var("DATABASE_URL")
            .ok()
            .is_some_and(|url| !url.trim().is_empty())
}

/// Returns `true` when hosted Rustume Cloud should reject anonymous billable API use.
///
/// Only meaningful when [`cloud_enabled`] is also true.
pub fn require_auth_enabled() -> bool {
    require_auth_from_env(cloud_enabled(), std::env::var("RUSTUME_REQUIRE_AUTH").ok())
}

fn require_auth_from_env(cloud: bool, value: Option<String>) -> bool {
    cloud && matches!(value.as_deref().map(str::trim), Some("true" | "1"))
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
    /// OAuth redirect URI validated at startup.
    pub workos_redirect_uri: String,
}

/// Connect to PostgreSQL, run migrations, and wire cloud auth services.
pub async fn init_cloud(config: CloudConfig) -> anyhow::Result<Arc<CloudState>> {
    let db = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
        .acquire_timeout(Duration::from_secs(config.db_acquire_timeout_secs))
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./src/db/migrations").run(&db).await?;

    info!("PostgreSQL migrations applied");

    let workos = WorkOsClient::new(config.workos_client_id, config.workos_api_key);
    let cookie_secure = config.workos_redirect_uri.starts_with("https://");
    let sessions = SessionService::new(db.clone(), config.session_secret, cookie_secure);
    let workos_redirect_uri = config.workos_redirect_uri;

    Ok(Arc::new(CloudState {
        db,
        workos,
        sessions,
        workos_redirect_uri,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn require_auth_from_env_requires_cloud_and_truthy_flag() {
        assert!(!require_auth_from_env(false, Some("true".to_string())));
        assert!(!require_auth_from_env(true, None));
        assert!(!require_auth_from_env(true, Some("false".to_string())));
        assert!(require_auth_from_env(true, Some("true".to_string())));
        assert!(require_auth_from_env(true, Some("1".to_string())));
    }
}
