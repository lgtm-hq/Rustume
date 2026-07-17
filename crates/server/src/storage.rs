//! Always-on PostgreSQL storage: pool bootstrap, migrations, encryption at
//! rest, and the implicit local user for self-hosted deployments.
//!
//! Cloud mode ([`crate::cloud`]) layers WorkOS auth and sessions on top of
//! this storage layer; self-hosted mode uses it directly with a seeded local
//! user and no authentication.

use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::OnceCell;
use tracing::{error, info};
use uuid::Uuid;

use crate::db::{ResumeRow, StoredResumeRow, User};
use crate::encryption::EncryptionService;
use crate::error::ApiError;

/// Fixed UUID of the implicit self-hosted user (`00000000-0000-0000-0000-000000000001`).
pub const LOCAL_USER_ID: Uuid = Uuid::from_u128(1);

/// Sentinel `workos_id` marking the implicit self-hosted user.
///
/// A future local-to-cloud linking flow replaces this with a real WorkOS ID.
pub const LOCAL_WORKOS_ID: &str = "local";

/// Plan label for the implicit self-hosted user.
pub const LOCAL_USER_PLAN: &str = "self-hosted";

/// Storage settings loaded from environment variables.
#[derive(Clone)]
pub struct StorageConfig {
    /// PostgreSQL connection string (`DATABASE_URL`).
    pub database_url: String,
    /// Maximum PostgreSQL pool connections (`DB_MAX_CONNECTIONS`, default 10).
    pub db_max_connections: u32,
    /// Pool acquire timeout in seconds (`DB_ACQUIRE_TIMEOUT_SECS`, default 5).
    pub db_acquire_timeout_secs: u64,
    /// Whether new resume writes are encrypted (`RUSTUME_ENCRYPT_AT_REST`).
    pub encrypt_at_rest: bool,
}

impl std::fmt::Debug for StorageConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StorageConfig")
            .field("database_url", &"<redacted>")
            .field("db_max_connections", &self.db_max_connections)
            .field("db_acquire_timeout_secs", &self.db_acquire_timeout_secs)
            .field("encrypt_at_rest", &self.encrypt_at_rest)
            .finish()
    }
}

impl StorageConfig {
    /// Load storage settings from the environment.
    ///
    /// Returns `Ok(None)` when `DATABASE_URL` is not set (stateless fallback).
    pub fn from_env(cloud: bool) -> anyhow::Result<Option<Self>> {
        let Some(database_url) = std::env::var("DATABASE_URL")
            .ok()
            .map(|url| url.trim().to_string())
            .filter(|url| !url.is_empty())
        else {
            return Ok(None);
        };

        Ok(Some(Self {
            database_url,
            db_max_connections: crate::cloud::optional_env_u32("DB_MAX_CONNECTIONS", 10)?,
            db_acquire_timeout_secs: crate::cloud::optional_env_u64("DB_ACQUIRE_TIMEOUT_SECS", 5)?,
            encrypt_at_rest: encrypt_at_rest_enabled(cloud)?,
        }))
    }
}

/// Resolve the `RUSTUME_ENCRYPT_AT_REST` toggle.
///
/// Defaults to `true` for self-hosted deployments and `false` for cloud.
/// Fails fast on unrecognized values so a typo cannot silently change how
/// resume data is persisted.
pub fn encrypt_at_rest_enabled(cloud: bool) -> anyhow::Result<bool> {
    encrypt_at_rest_from_env(cloud, std::env::var("RUSTUME_ENCRYPT_AT_REST").ok())
}

fn encrypt_at_rest_from_env(cloud: bool, value: Option<String>) -> anyhow::Result<bool> {
    match value.as_deref().map(str::trim) {
        Some("true" | "1") => Ok(true),
        Some("false" | "0") => Ok(false),
        Some("") | None => Ok(!cloud),
        Some(other) => {
            anyhow::bail!("RUSTUME_ENCRYPT_AT_REST must be one of true, false, 1, 0; got {other:?}")
        }
    }
}

/// Resume data ready to be bound to the `data` / `data_encrypted` columns.
#[derive(Debug)]
pub struct EncodedResumeData {
    /// Plaintext JSONB payload (`data` column), when encryption is off.
    pub data: Option<serde_json::Value>,
    /// AES-256-GCM blob (`data_encrypted` column), when encryption is on.
    pub data_encrypted: Option<Vec<u8>>,
}

/// Shared storage services: PostgreSQL pool and encryption at rest.
#[derive(Clone)]
pub struct StorageState {
    /// PostgreSQL connection pool.
    pub db: PgPool,
    /// Encryption service, present when a key is configured or generated.
    pub encryption: Option<EncryptionService>,
    /// Whether new resume writes are encrypted.
    pub encrypt_at_rest: bool,
    /// Lazily cached implicit local user (self-hosted mode), shared across
    /// clones so the per-request `AuthUser` extraction skips the database.
    local_user_cell: Arc<OnceCell<User>>,
}

impl StorageState {
    /// Build a storage state around an existing pool.
    #[must_use]
    pub fn new(db: PgPool, encryption: Option<EncryptionService>, encrypt_at_rest: bool) -> Self {
        Self {
            db,
            encryption,
            encrypt_at_rest,
            local_user_cell: Arc::new(OnceCell::new()),
        }
    }

    /// Encode resume JSON for persistence, encrypting when enabled.
    ///
    /// The resume ID is bound as associated data so an encrypted blob copied
    /// into a different row fails to decrypt.
    pub fn encode_resume_data(
        &self,
        data: serde_json::Value,
        resume_id: Uuid,
    ) -> Result<EncodedResumeData, ApiError> {
        if !self.encrypt_at_rest {
            return Ok(EncodedResumeData {
                data: Some(data),
                data_encrypted: None,
            });
        }

        let encryption = self.encryption.as_ref().ok_or_else(|| {
            error!("encrypt-at-rest enabled but no encryption key is configured");
            ApiError::internal("internal server error")
        })?;
        let blob = encryption
            .encrypt(&data, resume_id.as_bytes())
            .map_err(|err| {
                error!("resume encryption failed: {err}");
                ApiError::internal("internal server error")
            })?;
        Ok(EncodedResumeData {
            data: None,
            data_encrypted: Some(blob),
        })
    }

    /// Decode a stored resume payload, decrypting when necessary.
    pub fn decode_resume_data(
        &self,
        data: Option<serde_json::Value>,
        data_encrypted: Option<Vec<u8>>,
        resume_id: Uuid,
    ) -> Result<serde_json::Value, ApiError> {
        if let Some(data) = data {
            return Ok(data);
        }

        let Some(blob) = data_encrypted else {
            error!("resume row has neither data nor data_encrypted");
            return Err(ApiError::internal("internal server error"));
        };
        let encryption = self.encryption.as_ref().ok_or_else(|| {
            error!("encrypted resume data present but no encryption key is configured");
            ApiError::internal("internal server error")
        })?;
        encryption
            .decrypt(&blob, resume_id.as_bytes())
            .map_err(|err| {
                error!("resume decryption failed: {err}");
                ApiError::internal("internal server error")
            })
    }

    /// Convert a stored row into the API row, decrypting the payload as needed.
    pub fn decode_resume_row(&self, row: StoredResumeRow) -> Result<ResumeRow, ApiError> {
        let StoredResumeRow {
            id,
            user_id,
            title,
            data,
            data_encrypted,
            is_public,
            public_slug,
            password_hash,
            version,
            created_at,
            updated_at,
        } = row;
        let data = self.decode_resume_data(data, data_encrypted, id)?;
        Ok(ResumeRow {
            id,
            user_id,
            title,
            data,
            is_public,
            public_slug,
            password_hash,
            version,
            created_at,
            updated_at,
        })
    }

    /// Fetch the implicit self-hosted user, seeding it if missing.
    ///
    /// The row is immutable after seeding (until future cloud linking), so it
    /// is cached after the first lookup to avoid a per-request query.
    pub async fn local_user(&self) -> Result<User, ApiError> {
        self.local_user_cell
            .get_or_try_init(|| fetch_or_seed_local_user(&self.db))
            .await
            .cloned()
    }
}

async fn fetch_or_seed_local_user(db: &PgPool) -> Result<User, ApiError> {
    if let Some(user) = fetch_local_user(db).await? {
        return Ok(user);
    }

    seed_local_user(db).await.map_err(|err| {
        error!("local user seed failed: {err}");
        ApiError::internal("internal server error")
    })?;
    fetch_local_user(db).await?.ok_or_else(|| {
        error!("local user missing after seed");
        ApiError::internal("internal server error")
    })
}

async fn fetch_local_user(db: &PgPool) -> Result<Option<User>, ApiError> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(LOCAL_USER_ID)
        .fetch_optional(db)
        .await
        .map_err(|err| {
            error!("local user lookup failed: {err}");
            ApiError::internal("internal server error")
        })
}

/// Insert the implicit self-hosted user row if it does not exist yet.
pub async fn seed_local_user(db: &PgPool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO users (id, workos_id, plan)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(LOCAL_USER_ID)
    .bind(LOCAL_WORKOS_ID)
    .bind(LOCAL_USER_PLAN)
    .execute(db)
    .await?;
    Ok(())
}

/// Connect to PostgreSQL, run migrations, and wire the encryption service.
pub async fn init_storage(config: StorageConfig) -> anyhow::Result<Arc<StorageState>> {
    let db = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
        .acquire_timeout(Duration::from_secs(config.db_acquire_timeout_secs))
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./src/db/migrations").run(&db).await?;
    info!("PostgreSQL migrations applied");

    let encryption = if config.encrypt_at_rest || EncryptionService::key_configured() {
        Some(EncryptionService::init()?)
    } else {
        None
    };
    info!(
        encrypt_at_rest = config.encrypt_at_rest,
        "Resume storage initialized"
    );

    Ok(Arc::new(StorageState::new(
        db,
        encryption,
        config.encrypt_at_rest,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_at_rest_defaults_on_for_self_hosted() {
        assert!(encrypt_at_rest_from_env(false, None).unwrap());
        assert!(!encrypt_at_rest_from_env(true, None).unwrap());
        assert!(encrypt_at_rest_from_env(false, Some(String::new())).unwrap());
    }

    #[test]
    fn encrypt_at_rest_env_overrides_defaults() {
        assert!(!encrypt_at_rest_from_env(false, Some("false".to_string())).unwrap());
        assert!(!encrypt_at_rest_from_env(false, Some("0".to_string())).unwrap());
        assert!(encrypt_at_rest_from_env(true, Some("true".to_string())).unwrap());
        assert!(encrypt_at_rest_from_env(true, Some("1".to_string())).unwrap());
    }

    #[test]
    fn encrypt_at_rest_rejects_unrecognized_values() {
        let err = encrypt_at_rest_from_env(false, Some("garbage".to_string()))
            .expect_err("typo must fail fast");
        assert!(err.to_string().contains("RUSTUME_ENCRYPT_AT_REST"));
    }

    #[test]
    fn local_user_id_is_fixed_sentinel() {
        assert_eq!(
            LOCAL_USER_ID.to_string(),
            "00000000-0000-0000-0000-000000000001"
        );
    }
}
