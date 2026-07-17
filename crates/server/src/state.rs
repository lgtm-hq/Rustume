use std::path::PathBuf;
use std::sync::Arc;

use sqlx::PgPool;

use rustume_render::TypstRenderer;

use crate::cloud::CloudState;
use crate::config::RateLimitConfig;
use crate::middleware::rate_limit::RateLimitState;
use crate::storage::StorageState;

/// Shared router state for all handlers.
#[derive(Clone)]
pub struct AppState {
    pub static_dir: Arc<PathBuf>,
    /// Persistent resume storage (PostgreSQL + encryption). `None` only in
    /// stateless fallback mode when `DATABASE_URL` is not configured.
    pub storage: Option<Arc<StorageState>>,
    /// Cloud auth services (WorkOS, sessions). `None` in self-hosted mode.
    pub cloud: Option<Arc<CloudState>>,
    pub renderer: Arc<TypstRenderer>,
    /// When true, billable API routes require a valid session (hosted Rustume Cloud).
    pub require_auth: bool,
    /// In-memory rate limiters (cloud mode only).
    pub rate_limits: Option<Arc<RateLimitState>>,
}

impl AppState {
    /// Build application state with a shared Typst renderer instance.
    pub fn new(
        static_dir: Arc<PathBuf>,
        storage: Option<Arc<StorageState>>,
        cloud: Option<Arc<CloudState>>,
    ) -> Self {
        let rate_limits = cloud
            .as_ref()
            .map(|_| Arc::new(RateLimitState::new(RateLimitConfig::from_env())));
        Self {
            static_dir,
            storage,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth: crate::cloud::require_auth_enabled(),
            rate_limits,
        }
    }

    /// Build application state with an explicit require-auth flag (tests).
    #[cfg(test)]
    pub fn with_require_auth(
        static_dir: Arc<PathBuf>,
        storage: Option<Arc<StorageState>>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
    ) -> Self {
        Self::with_options(
            static_dir,
            storage,
            cloud,
            require_auth,
            RateLimitConfig::from_env(),
        )
    }

    /// Build application state with explicit cloud and rate limit settings (tests).
    #[cfg(test)]
    pub fn with_options(
        static_dir: Arc<PathBuf>,
        storage: Option<Arc<StorageState>>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
        rate_limit_config: RateLimitConfig,
    ) -> Self {
        let rate_limits = cloud
            .as_ref()
            .map(|_| Arc::new(RateLimitState::new(rate_limit_config)));
        Self {
            static_dir,
            storage,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth,
            rate_limits,
        }
    }

    /// Return cloud services or a 404 when cloud mode is disabled.
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found("Cloud features are not enabled on this server")
        })
    }

    /// Return the storage layer or a 404 when persistent storage is disabled.
    pub fn storage(&self) -> Result<&StorageState, crate::error::ApiError> {
        self.storage.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found(
                "Persistent storage is not enabled on this server (DATABASE_URL is not set)",
            )
        })
    }

    /// Return the shared PostgreSQL pool or a 404 when storage is disabled.
    pub fn db(&self) -> Result<&PgPool, crate::error::ApiError> {
        self.storage().map(|storage| &storage.db)
    }
}
