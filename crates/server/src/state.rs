use std::path::PathBuf;
use std::sync::Arc;

use rustume_render::TypstRenderer;

use crate::cloud::CloudState;
use crate::config::{BillingConfig, RateLimitConfig};
use crate::middleware::rate_limit::RateLimitState;

/// Shared router state for all handlers.
#[derive(Clone)]
pub struct AppState {
    pub static_dir: Arc<PathBuf>,
    pub cloud: Option<Arc<CloudState>>,
    pub renderer: Arc<TypstRenderer>,
    /// When true, billable API routes require a valid session (hosted Rustume Cloud).
    pub require_auth: bool,
    /// In-memory rate limiters (cloud mode only).
    pub rate_limits: Option<Arc<RateLimitState>>,
    /// Paddle Billing credentials when all billing env vars are set.
    pub billing: Option<BillingConfig>,
}

impl AppState {
    /// Build application state with a shared Typst renderer instance.
    pub fn new(static_dir: Arc<PathBuf>, cloud: Option<Arc<CloudState>>) -> Self {
        let rate_limits = cloud
            .as_ref()
            .map(|_| Arc::new(RateLimitState::new(RateLimitConfig::from_env())));
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth: crate::cloud::require_auth_enabled(),
            rate_limits,
            billing: BillingConfig::from_env(),
        }
    }

    /// Build application state with an explicit require-auth flag (tests).
    #[cfg(test)]
    pub fn with_require_auth(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
    ) -> Self {
        Self::with_options_from_env(static_dir, cloud, require_auth, RateLimitConfig::from_env())
    }

    /// Build application state with explicit cloud and rate limit settings (tests).
    #[cfg(test)]
    pub fn with_options(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
        rate_limit_config: RateLimitConfig,
        billing: Option<BillingConfig>,
    ) -> Self {
        let rate_limits = cloud
            .as_ref()
            .map(|_| Arc::new(RateLimitState::new(rate_limit_config)));
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth,
            rate_limits,
            billing,
        }
    }

    /// Build application state with explicit cloud and rate limit settings (tests).
    #[cfg(test)]
    pub fn with_options_from_env(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
        rate_limit_config: RateLimitConfig,
    ) -> Self {
        Self::with_options(
            static_dir,
            cloud,
            require_auth,
            rate_limit_config,
            BillingConfig::from_env(),
        )
    }

    /// Return cloud services or a 404 when cloud mode is disabled.
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found("Cloud features are not enabled on this server")
        })
    }
}
