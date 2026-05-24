use std::path::PathBuf;
use std::sync::Arc;

use crate::cloud::CloudState;

/// Shared router state for all handlers.
#[derive(Clone)]
pub struct AppState {
    pub static_dir: Arc<PathBuf>,
    pub cloud: Option<Arc<CloudState>>,
}

impl AppState {
    pub fn cloud(&self) -> Result<&CloudState, crate::error::ApiError> {
        self.cloud.as_deref().ok_or_else(|| {
            crate::error::ApiError::new("Cloud features are not enabled on this server")
        })
    }
}
