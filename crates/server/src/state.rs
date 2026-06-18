use std::path::PathBuf;
use std::sync::Arc;

use rustume_render::TypstRenderer;

use crate::cloud::CloudState;

/// Shared router state for all handlers.
#[derive(Clone)]
pub struct AppState {
    pub static_dir: Arc<PathBuf>,
    pub cloud: Option<Arc<CloudState>>,
    pub renderer: Arc<TypstRenderer>,
    /// When true, billable API routes require a valid session (hosted Rustume Cloud).
    pub require_auth: bool,
}

impl AppState {
    /// Build application state with a shared Typst renderer instance.
    pub fn new(static_dir: Arc<PathBuf>, cloud: Option<Arc<CloudState>>) -> Self {
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth: crate::cloud::require_auth_enabled(),
        }
    }

    /// Build application state with an explicit require-auth flag (tests).
    #[cfg(test)]
    pub fn with_require_auth(
        static_dir: Arc<PathBuf>,
        cloud: Option<Arc<CloudState>>,
        require_auth: bool,
    ) -> Self {
        Self {
            static_dir,
            cloud,
            renderer: Arc::new(TypstRenderer::new()),
            require_auth,
        }
    }

    /// Return cloud services or a 404 when cloud mode is disabled.
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::not_found("Cloud features are not enabled on this server")
        })
    }
}
