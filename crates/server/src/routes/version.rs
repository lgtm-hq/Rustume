//! Build-metadata endpoint used to verify which build is actually serving.
//!
//! `GET /version` is deliberately unauthenticated (and rate limited alongside
//! `/health` in cloud mode) so a deploy pipeline can confirm the running
//! container without credentials. Nothing exposed here is sensitive: the
//! version is already published in the OpenAPI document and the commit is
//! public on GitHub.
//!
//! `commit` and `built_at` come from optional build metadata baked in by
//! `docker/Dockerfile` (see `crates/server/build.rs`). Builds without that
//! metadata — `cargo run`, `cargo test`, plain `cargo build` — report `null`
//! for both fields rather than failing to compile or panicking.

use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Build metadata for the running server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct VersionResponse {
    /// Crate version of the running build.
    #[schema(example = "0.44.0")]
    pub version: String,
    /// Short git commit the build was compiled from, or `null` when the build
    /// carried no commit metadata.
    #[schema(example = "c515854")]
    pub commit: Option<String>,
    /// RFC 3339 UTC build timestamp, or `null` when the build carried no
    /// timestamp metadata.
    #[schema(example = "2026-07-25T19:38:00Z")]
    pub built_at: Option<String>,
}

/// Version of the running build, from `CARGO_PKG_VERSION`.
const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Commit baked in by the build script, when the build supplied one.
const COMMIT: Option<&str> = option_env!("RUSTUME_GIT_COMMIT");

/// Build timestamp baked in by the build script, when the build supplied one.
const BUILT_AT: Option<&str> = option_env!("RUSTUME_BUILD_TIME");

/// Treat blank build metadata as absent so an empty build arg degrades to
/// `null` instead of an empty string.
fn present(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

impl VersionResponse {
    /// Build metadata for the currently running binary.
    #[must_use]
    pub fn current() -> Self {
        Self {
            version: VERSION.to_owned(),
            commit: present(COMMIT),
            built_at: present(BUILT_AT),
        }
    }
}

/// Build version
///
/// Returns the version, commit, and build time of the running build so a deploy
/// can be verified with a single cheap request.
#[utoipa::path(
    get,
    path = "/version",
    tag = "Health",
    responses(
        (status = 200, description = "Build metadata for the running server", body = VersionResponse)
    )
)]
pub async fn version() -> Json<VersionResponse> {
    Json(VersionResponse::current())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_reports_the_crate_version() {
        assert_eq!(
            VersionResponse::current().version,
            env!("CARGO_PKG_VERSION")
        );
    }

    #[test]
    fn missing_build_metadata_degrades_to_none() {
        assert_eq!(present(None), None);
    }

    #[test]
    fn blank_build_metadata_degrades_to_none() {
        assert_eq!(present(Some("")), None);
        assert_eq!(present(Some("   ")), None);
    }

    #[test]
    fn present_build_metadata_is_trimmed() {
        assert_eq!(present(Some(" c515854\n")), Some("c515854".to_owned()));
    }

    #[tokio::test]
    async fn handler_returns_current_build_metadata() {
        let Json(payload) = version().await;

        assert_eq!(payload, VersionResponse::current());
    }
}
