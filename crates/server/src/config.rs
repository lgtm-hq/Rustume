//! Server configuration constants.

/// Maximum request body size (10 MB)
pub const MAX_BODY_SIZE: usize = 10 * 1024 * 1024;

/// Default server port
pub const DEFAULT_PORT: u16 = 3000;

/// Default location for the production web bundle in the container image.
pub const DEFAULT_STATIC_DIR: &str = "/app/web";
