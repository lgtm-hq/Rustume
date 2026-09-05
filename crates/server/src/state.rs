use std::path::PathBuf;
use std::sync::Arc;

use rustume_render::TypstRenderer;
use tokio::sync::Semaphore;

use crate::cloud::CloudState;
use crate::config::{floor_export_concurrency, rate_limits_enabled_from_env, RateLimitConfig};
use crate::middleware::rate_limit::RateLimitState;

/// Shared router state for all handlers.
#[derive(Clone)]
pub struct AppState {
    pub static_dir: Arc<PathBuf>,
    pub cloud: Option<Arc<CloudState>>,
    pub renderer: Arc<TypstRenderer>,
    /// Whether this deployment requires a session, as advertised to clients via
    /// `/auth/me`. Always mirrors cloud mode in production.
    ///
    /// This is a reporting value, not the enforcement switch: the middleware
    /// gates on cloud presence so no flag can re-open a billable deployment.
    pub require_auth: bool,
    /// In-memory rate limiters (cloud mode only).
    pub rate_limits: Option<Arc<RateLimitState>>,
    /// Bounds concurrent GDPR account exports per process
    /// (`RATE_LIMIT_ACCOUNT_EXPORT_CONCURRENCY`, default 2). Each export streams
    /// an unbounded amount of data while holding one database connection, so
    /// without a ceiling a handful of slow downloads could exhaust the pool
    /// for every other request.
    pub export_permits: Arc<Semaphore>,
}

/// The one place the export semaphore is sized, so production and test
/// constructors cannot drift on the floor policy.
fn export_permits(config: &RateLimitConfig) -> Arc<Semaphore> {
    Arc::new(Semaphore::new(
        floor_export_concurrency(config.account_export_concurrency) as usize,
    ))
}

impl AppState {
    /// Build application state with a shared Typst renderer instance.
    pub fn new(static_dir: Arc<PathBuf>, cloud: Option<Arc<CloudState>>) -> Self {
        Self::from_config(
            static_dir,
            cloud,
            RateLimitConfig::from_env(),
            rate_limits_enabled_from_env(),
        )
    }

    /// Production constructor with the environment already read, so the
    /// gating rules are unit-testable without mutating process env.
    pub fn from_config(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        config: RateLimitConfig,
        rate_limits_enabled: bool,
    ) -> Self {
        // The export ceiling applies even when per-minute limits are disabled
        // for local development: it protects the pool, not the quota.
        let export_permits = export_permits(&config);
        let rate_limits = cloud
            .as_ref()
            .filter(|_| rate_limits_enabled)
            .map(|_| Arc::new(RateLimitState::new(config)));
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth: crate::cloud::require_auth_enabled(),
            rate_limits,
            export_permits,
        }
    }

    /// Build application state with an explicit advertised require-auth flag (tests).
    #[cfg(test)]
    pub fn with_require_auth(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
    ) -> Self {
        Self::with_options(static_dir, cloud, require_auth, RateLimitConfig::from_env())
    }

    /// Build application state with explicit cloud and rate limit settings (tests).
    #[cfg(test)]
    pub fn with_options(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
        rate_limit_config: RateLimitConfig,
    ) -> Self {
        let export_permits = export_permits(&rate_limit_config);
        let rate_limits = cloud
            .as_ref()
            .map(|_| Arc::new(RateLimitState::new(rate_limit_config)));
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth,
            rate_limits,
            export_permits,
        }
    }

    /// Return cloud services or a 404 when cloud mode is disabled.
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found("Cloud features are not enabled on this server")
        })
    }
}
