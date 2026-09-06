use std::path::PathBuf;
use std::sync::Arc;

use rustume_render::TypstRenderer;

use crate::cloud::CloudState;
use crate::config::{rate_limits_enabled_from_env, BillingConfig, RateLimitConfig};
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
    /// Paddle Billing credentials when all billing env vars are set.
    pub billing: Option<BillingConfig>,
}

impl AppState {
    /// Build application state with a shared Typst renderer instance.
    pub fn new(static_dir: Arc<PathBuf>, cloud: Option<Arc<CloudState>>) -> Self {
        let rate_limits = cloud
            .as_ref()
            .filter(|_| rate_limits_enabled_from_env())
            .map(|_| Arc::new(RateLimitState::new(RateLimitConfig::from_env())));
        // Billing is a cloud feature: routes and the Paddle CSP only exist
        // alongside a database, so leftover PADDLE_* on a self-hosted
        // deployment must not widen anything.
        let billing = cloud.as_ref().and_then(|_| BillingConfig::from_env());
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth: crate::cloud::require_auth_enabled(),
            rate_limits,
            billing,
        }
    }

    /// Build application state with an explicit advertised require-auth flag (tests).
    ///
    /// Billing is always off so stray `PADDLE_*` variables in a test
    /// environment cannot mount billing routes in unrelated tests; use
    /// [`Self::with_options_and_billing`] to test billing explicitly.
    #[cfg(test)]
    pub fn with_require_auth(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
    ) -> Self {
        Self::with_options(static_dir, cloud, require_auth, RateLimitConfig::from_env())
    }

    /// Build application state with explicit cloud and rate limit settings and
    /// billing disabled (tests).
    #[cfg(test)]
    pub fn with_options(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
        rate_limit_config: RateLimitConfig,
    ) -> Self {
        Self::with_options_and_billing(static_dir, cloud, require_auth, rate_limit_config, None)
    }

    /// Build application state with explicit cloud, rate limit, and billing settings (tests).
    #[cfg(test)]
    pub fn with_options_and_billing(
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
            renderer: Arc::new(TypstRenderer::new()),
            require_auth,
            rate_limits,
            // Same cloud gating as `new`, so tests cannot construct a state
            // production could never reach.
            billing: cloud.as_ref().and(billing),
            cloud,
        }
    }

    /// Return cloud services or a 404 when cloud mode is disabled.
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found("Cloud features are not enabled on this server")
        })
    }
}
